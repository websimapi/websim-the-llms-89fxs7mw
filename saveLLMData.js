import { llmDataManager } from './llmDataManager.js';
import { setupLLMCollectionView } from './llmCollectionView.js';
import { attributeSystem } from './attributeSystem.js';
import { storeModelData } from './llmModelStorage.js';
import { saveTTSVoiceSelection } from './llmTtsVoiceSelector.js';

// Function to save LLM data - moved from llmCreationInterface.js to reduce file size
export function saveLLMData() {
    // Get values from form
    const name = document.getElementById('llm-name').value || `LLM-${Math.floor(Math.random() * 1000)}`;
    const model = document.getElementById('llm-model').value;
    const color = document.getElementById('llm-color').value;
    // Style field removed, use default value
    const style = 'modern';
    const customPrompt = document.getElementById('llm-custom-prompt').value;
    
    console.log('Saving LLM with style:', style);
    
    // Get attributes
    const attributes = attributeSystem.exportAttributes();
    
    // Create LLM data object
    let llmData = {
        name,
        model,
        color,
        style,
        customPrompt,
        attributes,
        customCharacterCode: null
    };
    
    // If we have a custom character, save its code
    const statusElement = document.getElementById('generation-status');
    if (statusElement && statusElement.dataset.generatedCode) {
        llmData.customCharacterCode = statusElement.dataset.generatedCode;
        console.log("Saved custom character code:", llmData.customCharacterCode.substring(0, 50) + "...");
    } else {
        console.log("No custom character code found to save");
    }
    
    // Save profile image URL if available
    if (statusElement && statusElement.dataset.profileImageUrl) {
        llmData.profileImageUrl = statusElement.dataset.profileImageUrl;
        console.log("Saved profile image URL");
    }
    
    // Save TTS voice selection if available
    llmData = saveTTSVoiceSelection(llmData);
    
    // Store current model data - this handles colors and other properties
    // Get the current robot or custom model from the scene
    const humanoidScene = window.currentHumanoidScene;
    if (humanoidScene) {
        let modelToStore = null;
        
        // Find the model in the scene
        humanoidScene.traverse(child => {
            if (child.isGroup && (child === window.robotModel || child === window.customCharacter)) {
                modelToStore = child;
            }
        });
        
        if (modelToStore) {
            storeModelData(modelToStore, llmData);
        }
    }
    
    // Check if we're in edit mode
    const createUI = document.getElementById('create-llm-ui');
    const isEditMode = createUI.getAttribute('data-edit-mode') === 'true';
    const editId = createUI.getAttribute('data-edit-id');
    
    let savedLLMId;
    
    if (isEditMode && editId) {
        // Update existing LLM
        llmData.id = editId;
        savedLLMId = editId;
        const existingLLM = llmDataManager.getLLMById(editId);
        if (existingLLM) {
            llmData.createdAt = existingLLM.createdAt;
            
            // If no new character was generated, keep the existing character code
            if (!llmData.customCharacterCode && existingLLM.customCharacterCode) {
                llmData.customCharacterCode = existingLLM.customCharacterCode;
            }
            
            console.log('Updating LLM with ID:', editId, 'Style:', llmData.style);
            llmDataManager.updateLLM(llmData);
        } else {
            console.error("Could not find LLM with ID:", editId);
            // Fall back to adding as new
            savedLLMId = llmDataManager.addLLM(llmData);
        }
    } else {
        // Save as new LLM
        console.log('Adding new LLM with style:', llmData.style);
        savedLLMId = llmDataManager.addLLM(llmData);
    }
    
    // Close creation UI and show collection
    document.getElementById('create-llm-ui').classList.remove('active');
    setupLLMCollectionView(savedLLMId); // Pass the saved LLM ID to select it
}