export class Validator {
    private schema: any;
    private ruleCategories: Map<string, Set<string>> = new Map();

    constructor(schemaJson: string) {
        try {
            this.schema = JSON.parse(schemaJson);
            this.buildRuleMap();
        } catch (e) {
            console.error('Failed to parse schema for validation', e);
        }
    }

    private buildRuleMap() {
        const rulesDef = this.schema["$defs"]?.["Rules"]?.properties;
        if (!rulesDef) return;

        for (const category of Object.keys(rulesDef)) {
            if (category === 'recommended') continue;

            const categoryRules = new Set<string>();
            const categoryDef = rulesDef[category];

            let props = this.getProperties(categoryDef);
            if (props) {
                for (const rule of Object.keys(props)) {
                    categoryRules.add(rule);
                }
            }
            this.ruleCategories.set(category, categoryRules);
        }
    }

    private getProperties(def: any): any {
        if (!def) return null;
        if (def.properties) return def.properties;
        if (def["$ref"]) {
            const resolved = this.resolveRef(def["$ref"]);
            return this.getProperties(resolved);
        }
        if (def.anyOf) {
            for (const option of def.anyOf) {
                const p = this.getProperties(option);
                if (p) return p;
            }
        }
        if (def.oneOf) {
            for (const option of def.oneOf) {
                const p = this.getProperties(option);
                if (p) return p;
            }
        }
        return null;
    }

    private resolveRef(ref: string): any {
        const path = ref.replace("#/", "").split("/");
        let current = this.schema;
        for (const part of path) {
            if (!current) return null;
            current = current[part];
        }
        return current;
    }

    public validate(content: string): string[] {
        const errors: string[] = [];
        let json: any;
        try {
            // Biome allows trailing commas in some cases but JSON.parse does not.
            // However, the user asked for valid JSON validation.
            json = JSON.parse(content);
        } catch (e: any) {
            return [`Invalid JSON: ${e.message}`];
        }

        if (!this.schema) return [];

        // Check top level keys
        const allowedTopLevel = Object.keys(this.schema.properties || {});
        for (const key of Object.keys(json)) {
            if (key === '$schema') continue;
            if (!allowedTopLevel.includes(key)) {
                errors.push(`Unknown top-level property: "${key}"`);
            }
        }

        // Deep check for rules
        if (json.linter && json.linter.rules) {
            const rules = json.linter.rules;
            for (const category of Object.keys(rules)) {
                if (category === 'recommended' || category === 'all') continue;

                const validRules = this.ruleCategories.get(category);
                if (!validRules) {
                    errors.push(`Unknown rule category: "${category}"`);
                    continue;
                }

                if (typeof rules[category] === 'object' && rules[category] !== null) {
                    for (const ruleName of Object.keys(rules[category])) {
                        if (ruleName === 'recommended') continue;
                        if (!validRules.has(ruleName)) {
                            errors.push(`Unknown rule in "${category}": "${ruleName}"`);
                        }
                    }
                }
            }
        }

        return errors;
    }
}
