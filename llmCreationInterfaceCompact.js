// New file to reduce size of llmCreationInterface.js
import * as THREE from 'three';
import { createCustomCharacter } from './characterGenerator.js';
import { attributeSystem } from './attributeSystem.js';
import { setupAttributeTooltips, optimizeUIHeight } from './llmAttributeTooltips.js';

// Function to render the attribute grid - moved from llmCreationInterface.js
export function renderAttributeGrid() {
    const gridContainer = document.getElementById('attribute-grid');
    if (!gridContainer) return; // Add guard clause
    gridContainer.innerHTML = '';
    
    const attributesArray = attributeSystem.getAttributesArray();
    
    attributesArray.forEach(attr => {
        const item = document.createElement('div');
        item.className = 'attribute-item';
        
        const header = document.createElement('div');
        header.className = 'attribute-header';
        
        const name = document.createElement('div');
        name.className = 'attribute-name';
        name.textContent = attr.name;
        
        const controls = document.createElement('div');
        controls.className = 'attribute-controls';
        
        const decBtn = document.createElement('button');
        decBtn.className = 'attribute-button';
        decBtn.textContent = '-';
        decBtn.disabled = attr.value <= 0;
        decBtn.onclick = () => {
            if (attributeSystem.decrementAttribute(attr.name)) {
                renderAttributeGrid();
                updatePointsDisplay();
            }
        };
        
        const value = document.createElement('span');
        value.className = 'attribute-value-text';
        value.textContent = attr.value;
        
        const incBtn = document.createElement('button');
        incBtn.className = 'attribute-button';
        incBtn.textContent = '+';
        incBtn.disabled = attributeSystem.getRemainingPoints() <= 0 || 
                           attr.value >= attributeSystem.maxPointsPerAttribute;
        incBtn.onclick = () => {
            if (attributeSystem.incrementAttribute(attr.name)) {
                renderAttributeGrid();
                updatePointsDisplay();
            }
        };
        
        controls.appendChild(decBtn);
        controls.appendChild(value);
        controls.appendChild(incBtn);
        
        header.appendChild(name);
        header.appendChild(controls);
        
        const valueBar = document.createElement('div');
        valueBar.className = 'attribute-value';
        
        const valueFill = document.createElement('div');
        valueFill.className = 'attribute-fill';
        valueFill.style.width = `${(attr.value / attributeSystem.maxPointsPerAttribute) * 100}%`;
        
        valueBar.appendChild(valueFill);
        
        const description = document.createElement('div');
        description.className = 'attribute-description';
        description.textContent = attr.description;
        
        item.appendChild(header);
        item.appendChild(valueBar);
        item.appendChild(description);
        
        gridContainer.appendChild(item);
    });
}

// Function to update points display - moved from llmCreationInterface.js
export function updatePointsDisplay() {
    const pointsDisplay = document.getElementById('points-remaining');
    if (!pointsDisplay) return; // Add guard clause
    const remaining = attributeSystem.getRemainingPoints();
    pointsDisplay.textContent = `${remaining} Points Remaining`;
    
    // Change color based on points remaining
    if (remaining <= 3) {
        pointsDisplay.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
    } else if (remaining <= 7) {
        pointsDisplay.style.backgroundColor = 'rgba(255, 165, 0, 0.2)';
    } else {
        pointsDisplay.style.backgroundColor = 'rgba(60, 179, 113, 0.2)';
    }
}

// New function to reset profile image display when opening creation UI
export function resetProfileImageDisplay() {
    // Use the updated function from llmProfileImageDisplay
    import('./llmProfileImageDisplay.js').then(module => {
         module.updateProfileImageDisplay(null); // Pass null to show placeholder
     });
}

// Function to reset form elements
export function resetFormAttributes() {
    // Reset attributes
    attributeSystem.initializeAttributes();
    renderAttributeGrid();
    updatePointsDisplay();
    
    // Clear any stored profile image URL
    const statusElement = document.getElementById('generation-status');
    if (statusElement) {
        delete statusElement.dataset.profileImageUrl;
        delete statusElement.dataset.selectedVoice;
    }
    
    // Reset profile image display
    resetProfileImageDisplay();
    
    // Hide the preview if it's open
    const previewContainer = document.getElementById('profile-image-preview-container');
    if (previewContainer) {
        previewContainer.classList.add('hidden');
    }
    
    // Reset voice selection if available
    const voiceSelect = document.getElementById('llm-tts-voice');
    if (voiceSelect) {
        voiceSelect.selectedIndex = 0;
         // Find test button - it might not exist yet if TTS module hasn't loaded fully
         // const testBtn = document.getElementById('test-voice-btn');
         // if (testBtn) testBtn.disabled = true;
    }

    // Reset model badge selection to default (assistant)
    import('./modelBadgeSelector.js').then(module => {
        module.loadModelBadgeSelection('assistant', false); // Apply default attributes
    });

    // Reset manipulation controls display if an object was selected
    import('./llmMeshManipulator.js').then(module => {
        const manipulationControls = document.querySelector('.manipulation-controls');
        const noSelectionMessage = document.querySelector('.no-selection-message');
        if (manipulationControls) manipulationControls.style.display = 'none';
        if (noSelectionMessage) noSelectionMessage.style.display = 'block';
        const selectedMeshNameEl = document.getElementById('selected-mesh-name');
        if (selectedMeshNameEl) selectedMeshNameEl.classList.add('hidden');

        // Also clear the global selected mesh reference
        window.selectedMesh = null;
        if (typeof setSelectedMesh === 'function') setSelectedMesh(null);
    });
}

// New function to initialize profile image UI
export function setupProfileImageUI() {
    // Import and setup the profile image capture functionality
    import('./llmProfileImageUI.js').then(module => {
        module.setupProfileImageCapture();
    }).catch(error => {
        console.error("Error setting up profile image capture:", error);
    });
}

// Character generation handler - moved from llmCreationInterface.js
export async function handleGenerateCharacter(generatingCharacter, setGeneratingCharacter) {
    if (generatingCharacter) return;
    
    const promptInput = document.getElementById('llm-custom-prompt');
    const userPrompt = promptInput.value.trim();
    const statusElement = document.getElementById('generation-status');
    const generateBtn = document.getElementById('generate-character-btn');
    
    if (userPrompt.length < 5) {
        statusElement.textContent = "Please enter a more detailed description";
        return;
    }
    
    setGeneratingCharacter(true);
    statusElement.textContent = "Generating character...";
    generateBtn.disabled = true;
    
    try {
        // Import the function from characterGenerator.js to fix the reference error
        const { generateCharacterCode } = await import('./characterGenerator.js');
        const generatedCode = await generateCharacterCode(userPrompt);
        
        // Store the generated code for later use
        statusElement.dataset.generatedCode = generatedCode;
        
        // Return the generated code to the caller
        return {
            success: true,
            code: generatedCode
        };
    } catch (error) {
        console.error("Failed to generate character:", error);
        statusElement.textContent = "Failed to generate character. Try again with a different description.";
        return {
            success: false,
            error: error
        };
    } finally {
        setGeneratingCharacter(false);
        generateBtn.disabled = false;
    }
}