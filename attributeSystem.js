// Attribute system for LLM creation
export const attributeSystem = {
    // Total points available to spend
    totalPointsAvailable: 15,
    // Maximum points per attribute
    maxPointsPerAttribute: 20,
    // Current points spent
    pointsSpent: 0,
    
    // Attributes definitions
    attributes: {
        intelligence: { 
            value: 0, 
            description: "Ability to solve complex problems and process information" 
        },
        creativity: { 
            value: 0, 
            description: "Capacity for generating novel ideas and content" 
        },
        reliability: { 
            value: 0, 
            description: "Consistency in performance and accuracy" 
        },
        adaptability: { 
            value: 0, 
            description: "Ability to adjust to new situations and contexts" 
        },
        empathy: { 
            value: 0, 
            description: "Understanding and responding to emotional states" 
        },
        memory: { 
            value: 0, 
            description: "Ability to retain and recall information" 
        },
        efficiency: { 
            value: 0, 
            description: "Resource optimization and processing speed" 
        },
        communication: { 
            value: 0, 
            description: "Clarity and effectiveness in information exchange" 
        },
        reasoning: { 
            value: 0, 
            description: "Logical thinking and inference capabilities" 
        },
        learning: { 
            value: 0, 
            description: "Rate of acquiring new knowledge and skills" 
        }
    },
    
    // Initialize attributes with default values
    initializeAttributes() {
        Object.keys(this.attributes).forEach(attr => {
            this.attributes[attr].value = 0;
        });
        this.pointsSpent = 0;
    },
    
    // Increment attribute value
    incrementAttribute(attributeName) {
        const attribute = this.attributes[attributeName];
        if (!attribute) return false;
        
        // Check if there are points available and not at max
        if (this.pointsSpent < this.totalPointsAvailable && 
            attribute.value < this.maxPointsPerAttribute) {
            attribute.value++;
            this.pointsSpent++;
            return true;
        }
        return false;
    },
    
    // Decrement attribute value
    decrementAttribute(attributeName) {
        const attribute = this.attributes[attributeName];
        if (!attribute) return false;
        
        // Check if attribute has points to remove
        if (attribute.value > 0) {
            attribute.value--;
            this.pointsSpent--;
            return true;
        }
        return false;
    },
    
    // Get remaining available points
    getRemainingPoints() {
        return this.totalPointsAvailable - this.pointsSpent;
    },
    
    // Get attribute data as array for UI rendering
    getAttributesArray() {
        return Object.keys(this.attributes).map(key => ({
            name: key,
            ...this.attributes[key]
        }));
    },
    
    // Export attributes as data object
    exportAttributes() {
        const result = {};
        Object.keys(this.attributes).forEach(key => {
            result[key] = this.attributes[key].value;
        });
        return result;
    }
};