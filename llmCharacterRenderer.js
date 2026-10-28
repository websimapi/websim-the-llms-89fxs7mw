import { createCustomCharacter } from './characterGenerator.js';
import { createRobotModel } from './llmModelCreationRenderer.js';
import { applyStoredModelData } from './llmModelStorage.js';
import { prepareModelForIndividualColoring } from './llmMeshColorManager.js';

// Helper functions to create and render LLM characters
export function renderLLMCharacter(THREE, llm) {
    let model;
    if (llm.customCharacterCode) {
        // Create custom character from stored code
        try {
            model = createCustomCharacter(THREE, llm.customCharacterCode);
        } catch (error) {
            console.error("Error creating custom character:", error);
            // Fall back to standard model - using the detailed one now
            model = createStandardModel(THREE, llm);
        }
    } else {
        // Create standard model - using the detailed one now
        model = createStandardModel(THREE, llm);
    }

    // Prepare model for coloring/manipulation BEFORE applying stored data
    // This ensures meshes have unique materials if needed by applyStoredModelData
    prepareModelForIndividualColoring(model);

    // Apply stored model data if available AFTER model creation and preparation
    if (llm.modelData) {
        applyStoredModelData(model, llm);
    }

    return model;
}

// Standard model creation for LLMs without custom character code
function createStandardModel(THREE, llm) {
    // Create a robot model based on the stored properties
    const tempScene = new THREE.Scene();
    const color = llm.color || '#3cb371';
    const style = llm.style || 'modern';

    // Call the detailed robot model creation function
    const { model, materials } = createRobotModel(null, color, style);

    // We just need the model group itself
    return model;
}