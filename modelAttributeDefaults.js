// Default attribute assignments for each model type
export function assignDefaultAttributes(modelType, attributeSystem) {
    // Reset attributes first
    attributeSystem.initializeAttributes();
    
    // Set appropriate attributes based on model type with some randomization
    switch (modelType) {
        case 'assistant':
            attributeSystem.attributes.intelligence.value = 3 + Math.floor(Math.random() * 2);
            attributeSystem.attributes.reliability.value = 4 + Math.floor(Math.random() * 2);
            attributeSystem.attributes.memory.value = 2 + Math.floor(Math.random() * 2);
            attributeSystem.attributes.communication.value = 3 + Math.floor(Math.random() * 2);
            attributeSystem.attributes.adaptability.value = 1 + Math.floor(Math.random() * 2);
            break;
            
        case 'creator':
            attributeSystem.attributes.creativity.value = 5 + Math.floor(Math.random() * 2);
            attributeSystem.attributes.intelligence.value = 2 + Math.floor(Math.random() * 2);
            attributeSystem.attributes.adaptability.value = 2 + Math.floor(Math.random() * 2);
            attributeSystem.attributes.learning.value = 2 + Math.floor(Math.random() * 2);
            attributeSystem.attributes.reasoning.value = 2 + Math.floor(Math.random() * 2);
            break;
            
        case 'researcher':
            attributeSystem.attributes.intelligence.value = 4 + Math.floor(Math.random() * 2);
            attributeSystem.attributes.memory.value = 3 + Math.floor(Math.random() * 2);
            attributeSystem.attributes.reasoning.value = 4 + Math.floor(Math.random() * 2);
            attributeSystem.attributes.learning.value = 2 + Math.floor(Math.random() * 2);
            break;
            
        case 'companion':
            attributeSystem.attributes.empathy.value = 5 + Math.floor(Math.random() * 2);
            attributeSystem.attributes.adaptability.value = 3 + Math.floor(Math.random() * 2);
            attributeSystem.attributes.communication.value = 3 + Math.floor(Math.random() * 2);
            attributeSystem.attributes.creativity.value = 2 + Math.floor(Math.random() * 2);
            break;
            
        case 'humanoid':
            attributeSystem.attributes.adaptability.value = 3 + Math.floor(Math.random() * 2);
            attributeSystem.attributes.efficiency.value = 3 + Math.floor(Math.random() * 2);
            attributeSystem.attributes.learning.value = 3 + Math.floor(Math.random() * 2);
            attributeSystem.attributes.empathy.value = 1 + Math.floor(Math.random() * 2);
            attributeSystem.attributes.communication.value = 2 + Math.floor(Math.random() * 2);
            break;
    }
    
    // Calculate spent points
    let spentPoints = 0;
    Object.keys(attributeSystem.attributes).forEach(attr => {
        spentPoints += attributeSystem.attributes[attr].value;
    });
    
    // Check if we've exceeded available points and adjust if needed
    if (spentPoints > attributeSystem.totalPointsAvailable) {
        // Calculate the excess points
        const excessPoints = spentPoints - attributeSystem.totalPointsAvailable;
        
        // Remove excess points by reducing attributes one by one
        let pointsToRemove = excessPoints;
        
        while (pointsToRemove > 0) {
            // Identify attributes with values > 0
            const nonZeroAttrs = Object.keys(attributeSystem.attributes).filter(
                attr => attributeSystem.attributes[attr].value > 0
            );
            
            // Randomly select an attribute to reduce
            const randomAttr = nonZeroAttrs[Math.floor(Math.random() * nonZeroAttrs.length)];
            
            // Reduce the attribute by 1
            attributeSystem.attributes[randomAttr].value -= 1;
            pointsToRemove -= 1;
        }
        
        // Recalculate spent points after adjustment
        spentPoints = 0;
        Object.keys(attributeSystem.attributes).forEach(attr => {
            spentPoints += attributeSystem.attributes[attr].value;
        });
    }
    
    // Update spent points counter
    attributeSystem.pointsSpent = spentPoints;
    
    return spentPoints;
}