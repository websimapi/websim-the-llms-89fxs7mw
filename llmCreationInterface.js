import * as THREE from 'three';
// Removed characterGenerator imports, handled in renderer/compact files
import { attributeSystem } from './attributeSystem.js';
import { llmDataManager } from './llmDataManager.js';
import { setupLLMCollectionView } from './llmCollectionView.js';
import { saveLLMData } from './saveLLMData.js';
// Removed createStandardMaterials, handled in renderer
// Moved createRobotModel import to llmModelCreationRenderer.js
// Removed tooltip imports, handled in helpers
import { renderAttributeGrid, updatePointsDisplay, resetFormAttributes, handleGenerateCharacter } from './llmCreationInterfaceCompact.js';
// Removed mesh color manager imports, handled in renderer/manipulator
// Removed manipulator imports, handled in helpers
import { setGlobalReferences, setModels, setSelectedMesh, getGlobalReferences } from './threeJSGlobals.js';
import { initializeAllComponents } from './llmSetupHelpers.js';
// Import preview functions from the new location
import { initHumanoidPreview, updateSelectedMeshColor, resetPreviewModel, displayGeneratedCharacter, createDefaultRobotModel, restoreDefaultRobotModel } from './llmModelCreationRenderer.js';
import { optimizeUIHeight } from './llmAttributeTooltips.js'; // Keep this for resize handler
import { showConfirmationModal } from './confirmationModal.js'; // Import the custom modal function
import { hidePlotInfoPanel } from './plotHoverInfo.js'; // Import hide function
import { deactivateDroneTransport } from './llmDroneTransport.js'; // Import drone deactivation
import { playTrack } from './musicPlayer.js'; // Import music player function

// Removed global preview variables (humanoidScene, etc.) - managed within llmModelCreationRenderer.js now
// Removed model variables (robotModel, customCharacter, materials) - managed within llmModelCreationRenderer.js
let generatingCharacter = false; // Keep generation state


// Global function references for helpers (still needed?) - Let's keep them for now just in case
window.renderAttributeGrid = renderAttributeGrid;
window.updatePointsDisplay = updatePointsDisplay;

export function setupLLMCreationInterface(llmToEdit) {
    console.log("Setting up LLM Creation Interface. Editing:", !!llmToEdit);

    // --- Music Change ---
    playTrack('creation'); // Switch to creation music
    // --- End Music Change ---

    // Clear previous generation state
    const statusElement = document.getElementById('generation-status');
    if (statusElement) {
        statusElement.textContent = '';
        delete statusElement.dataset.generatedCode;
        delete statusElement.dataset.profileImageUrl;
        delete statusElement.dataset.selectedVoice;
    }
    generatingCharacter = false; // Reset generation flag


    // Setup default values for the form
    document.getElementById('llm-name').value = llmToEdit ? llmToEdit.name : `LLM-${Math.floor(Math.random() * 1000)}`;

    // Initialize attribute system
    attributeSystem.initializeAttributes();

    // If editing an existing LLM, load its attributes
    if (llmToEdit && llmToEdit.attributes) {
        let spentPoints = 0;
        Object.entries(llmToEdit.attributes).forEach(([name, value]) => {
            if (attributeSystem.attributes[name]) {
                attributeSystem.attributes[name].value = value;
                spentPoints += value; // Sum up loaded points
            }
        });
         attributeSystem.pointsSpent = spentPoints; // Set the correct spent points
    }

    // Render attribute grid AFTER potentially loading attributes
    renderAttributeGrid();
    updatePointsDisplay();

    // Add event listeners for form elements that should update the humanoid preview
    const colorInput = document.getElementById('llm-color');
    colorInput.removeEventListener('input', updateSelectedMeshColor); // Use the function from the renderer module
    colorInput.addEventListener('input', updateSelectedMeshColor);


    // Setup character generation button
    const generateBtn = document.getElementById('generate-character-btn');
    const newGenerateBtn = generateBtn.cloneNode(true); // Clone to remove listeners
    generateBtn.parentNode.replaceChild(newGenerateBtn, generateBtn);
    newGenerateBtn.addEventListener('click', () => {
        handleGenerateCharacter(generatingCharacter, (state) => { // Pass state setter
            generatingCharacter = state;
        }).then(result => {
            if (result && result.success) {
                // Call the function in the renderer module to display the new character
                displayGeneratedCharacter(result.code);
            }
        });
    });

    // Setup restore robot button
    const restoreBtn = document.getElementById('restore-robot-design-btn');
    const newRestoreBtn = restoreBtn.cloneNode(true); // Clone to remove listeners
    restoreBtn.parentNode.replaceChild(newRestoreBtn, restoreBtn);
    newRestoreBtn.addEventListener('click', () => {
        // Use the custom confirmation modal
        showConfirmationModal(
            "Are you sure you want to restore the default robot design? This will replace the current custom character, but attempt to keep colors.",
            () => { // onConfirm
                handleRestoreRobotDesign();
            },
            () => { // onCancel
                console.log("Restore cancelled.");
            }
        );
    });

    // Set form values from existing LLM if editing
    if (llmToEdit) {
        document.getElementById('llm-model').value = llmToEdit.model || 'assistant';
        document.getElementById('llm-color').value = llmToEdit.color || '#3cb371';
        document.getElementById('llm-custom-prompt').value = llmToEdit.customPrompt || '';
        const createUI = document.getElementById('create-llm-ui');
        createUI.setAttribute('data-edit-mode', 'true');
        createUI.setAttribute('data-edit-id', llmToEdit.id);
    } else {
        const createUI = document.getElementById('create-llm-ui');
        createUI.removeAttribute('data-edit-mode');
        createUI.removeAttribute('data-edit-id');
        document.getElementById('llm-color').value = '#3cb371';
        document.getElementById('llm-custom-prompt').value = '';
        document.getElementById('llm-model').value = 'assistant';
    }

    // Initialize the humanoid preview using the function from the renderer module
    initHumanoidPreview(llmToEdit); // Pass llmToEdit

    // Add event listener for create/save button
    const createLLMButton = document.querySelector('.create-llm-actions .create-llm-button:not(.secondary)');
    const newCreateBtn = createLLMButton.cloneNode(true);
    createLLMButton.parentNode.replaceChild(newCreateBtn, createLLMButton);
    newCreateBtn.addEventListener('click', saveLLMData);
    newCreateBtn.textContent = llmToEdit ? 'Save LLM' : 'Create LLM';

    // Add event listener for close button
    const closeButton = document.querySelector('.create-llm-close');
    const newCloseBtn = closeButton.cloneNode(true);
    closeButton.parentNode.replaceChild(newCloseBtn, closeButton);
    // Modify close button listener
    newCloseBtn.addEventListener('click', () => {
        if (window.droneActive) {
            showConfirmationModal(
                "Cancel drone transport to close the creator?",
                () => { // onConfirm
                    deactivateDroneTransport(true);
                    handleCreateLLMClose(); // Proceed with closing
                },
                () => { // onCancel
                    console.log("Close creator action cancelled due to active drone transport.");
                }
            );
        } else {
            handleCreateLLMClose(); // Close directly if drone not active
        }
    });


    // Add event listener for reset button
    const resetButton = document.querySelector('.create-llm-actions .create-llm-button.secondary');
    const newResetBtn = resetButton.cloneNode(true);
    resetButton.parentNode.replaceChild(newResetBtn, resetButton);
    newResetBtn.addEventListener('click', resetForm);

    // Add TTS style file if not already present
    if (!document.querySelector('link[href="llmTtsStyles.css"]')) {
        const ttsStylesheet = document.createElement('link');
        ttsStylesheet.rel = 'stylesheet';
        ttsStylesheet.href = 'llmTtsStyles.css';
        document.head.appendChild(ttsStylesheet);
    }

    // Initialize all UI components (TTS, Profile Image, Badges, Tooltips, Manipulator)
    initializeAllComponents(llmToEdit);

    // Handle window resize for optimizing UI height
    window.removeEventListener('resize', optimizeUIHeightHandler); // Remove previous listener
    window.addEventListener('resize', optimizeUIHeightHandler);
}

// Wrapper function for resize handler
function optimizeUIHeightHandler() {
     // Use optimizeUIHeight directly as it's imported
     optimizeUIHeight();
}

// Function to handle restoring the default robot design
async function handleRestoreRobotDesign() { // Make async
    // Clear generated code reference
    const statusElement = document.getElementById('generation-status');
    if (statusElement) delete statusElement.dataset.generatedCode;

    // Call the restore function in the renderer module
    await restoreDefaultRobotModel();
}

function resetForm() {
    // Reset name with random number
    document.getElementById('llm-name').value = `LLM-${Math.floor(Math.random() * 1000)}`;

    // Reset other form values
    document.getElementById('llm-model').selectedIndex = 0; // Assuming first option is default
    document.getElementById('llm-color').value = '#3cb371';
    document.getElementById('llm-custom-prompt').value = '';

    // Clear edit mode flags
    const createUI = document.getElementById('create-llm-ui');
    createUI.removeAttribute('data-edit-mode');
    createUI.removeAttribute('data-edit-id');

    // Use imported reset function for attributes and profile image etc.
    resetFormAttributes();

    // Reset the 3D preview model to the default robot
    resetPreviewModel();

    // Reset generation status
    const statusElement = document.getElementById('generation-status');
    if (statusElement) {
        statusElement.textContent = '';
        delete statusElement.dataset.generatedCode;
    }

     // Deselect any selected mesh in the UI and global state
     const selectedMeshNameEl = document.getElementById('selected-mesh-name');
     if (selectedMeshNameEl) selectedMeshNameEl.classList.add('hidden');
     setSelectedMesh(null);
     const manipulationControls = document.querySelector('.manipulation-controls');
     const noSelectionMessage = document.querySelector('.no-selection-message');
     if (manipulationControls) manipulationControls.style.display = 'none';
     if (noSelectionMessage) noSelectionMessage.style.display = 'block';

}

function handleCreateLLMClose() {
    const createLLMUI = document.getElementById('create-llm-ui');
    createLLMUI.classList.remove('active');
    hidePlotInfoPanel(); // Hide plot info when closing this UI too

    // --- Music Change ---
    // Only switch back to city music if not immediately opening collection view
    if (window.createLLMOpenedFrom !== 'collection') {
        playTrack('city');
    }
    // --- End Music Change ---

    // Determine where to go back to
    if (window.createLLMOpenedFrom === 'collection') {
        // Go back to collection view (which will handle its own music change)
        import('./llmCollectionView.js').then(module => {
            module.setupLLMCollectionView();
            document.getElementById('llm-collection-ui').classList.add('active');
        });
    } 
    // Otherwise just close the UI to return to plot view (default behavior)
}