import { setupTTSVoiceSelector, loadTTSVoiceSelection } from './llmTtsVoiceSelector.js';
import { setupProfileImageDisplay } from './llmProfileImageDisplay.js';
import { attributeSystem } from './attributeSystem.js'; 
import { setupProfileImageCapture } from './llmProfileImageUI.js'; 
import { createDefaultRobotModel } from './llmModelCreationRenderer.js';
import { renderAttributeGrid, updatePointsDisplay } from './llmCreationInterfaceCompact.js';

export function initializeAllComponents(llmToEdit) {
    setupUIComponents(llmToEdit);

    if (llmToEdit) {
        loadLLMData(llmToEdit);
    } else {
        import('./modelAttributeDefaults.js').then(module => {
            module.assignDefaultAttributes('assistant', attributeSystem);
            renderAttributeGrid();
            updatePointsDisplay();
        }).catch(err => console.error("Error assigning default attributes:", err));
    }
}

function setupUIComponents(llmToEdit = null) {
    setupProfileImageDisplay(llmToEdit);

    setupProfileImageCapture();

    setupTTSVoiceSelector();

    import('./modelBadgeSelector.js').then(module => {
        module.setupModelBadgeSelector();
        if (llmToEdit && llmToEdit.model) {
             setTimeout(() => module.loadModelBadgeSelection(llmToEdit.model, true), 50);
        } else if (!llmToEdit) {
             setTimeout(() => module.loadModelBadgeSelection('assistant', false), 50);
        }
    }).catch(err => console.error("Error setting up model badges:", err));

    import('./llmAttributeTooltips.js').then(module => {
        setTimeout(() => {
            module.setupAttributeTooltips();
            module.optimizeUIHeight();
        }, 100); 
    }).catch(err => console.error("Error setting up tooltips:", err));

    import('./llmMeshManipulator.js').then(module => {
        setTimeout(() => { 
            module.initMeshManipulator();

            const manipulationControls = document.querySelector('.manipulation-controls');
            const noSelectionMessage = document.querySelector('.no-selection-message');
            if (manipulationControls) manipulationControls.style.display = 'none';
            if (noSelectionMessage) noSelectionMessage.style.display = 'block';
        }, 150);
    }).catch(err => console.error("Error setting up manipulator:", err));
}

function loadLLMData(llm) {
    loadTTSVoiceSelection(llm);
}