import { assignDefaultAttributes } from './modelAttributeDefaults.js';
import { attributeSystem } from './attributeSystem.js';
import { renderAttributeGrid, updatePointsDisplay } from './llmCreationInterfaceCompact.js';

export function setupModelBadgeSelector() {
    const modelContainer = document.querySelector('.model-badge-container');
    if (!modelContainer) return;
    
    // Get all model badges
    const badges = modelContainer.querySelectorAll('.model-badge');
    
    // Add click event listeners
    badges.forEach(badge => {
        badge.addEventListener('click', function() {
            // Get the radio input inside this badge
            const input = this.querySelector('input[type="radio"]');
            if (input) {
                // Check the input
                input.checked = true;
                
                // Update selected status on all badges
                badges.forEach(b => {
                    b.classList.remove('selected');
                });
                
                // Add selected class to clicked badge
                this.classList.add('selected');
                
                // Update the hidden select element to maintain form compatibility
                const modelSelect = document.getElementById('llm-model');
                if (modelSelect) {
                    modelSelect.value = input.value;
                }
                
                // Check if we're in edit mode - if yes, don't change attributes
                const createUI = document.getElementById('create-llm-ui');
                const isEditMode = createUI.getAttribute('data-edit-mode') === 'true';
                
                if (!isEditMode) {
                    // Only apply default attributes if NOT editing
                    const modelType = input.value;
                    assignDefaultAttributes(modelType, attributeSystem);
                    renderAttributeGrid();
                    updatePointsDisplay();
                }
            }
        });
    });
    
    // Initialize selected state based on the select value
    const modelSelect = document.getElementById('llm-model');
    if (modelSelect && modelSelect.value) {
        const selectedValue = modelSelect.value;
        const selectedBadge = document.querySelector(`.model-badge input[value="${selectedValue}"]`);
        if (selectedBadge) {
            selectedBadge.closest('.model-badge').classList.add('selected');
            
            // Check if we're in edit mode before applying defaults
            const createUI = document.getElementById('create-llm-ui');
            const isEditMode = createUI.getAttribute('data-edit-mode') === 'true';
            
            if (!isEditMode) {
                // Only apply default attributes if NOT editing
                assignDefaultAttributes(selectedValue, attributeSystem);
                
                // Make sure to render the grid if it exists
                if (document.getElementById('attribute-grid')) {
                    renderAttributeGrid();
                    updatePointsDisplay();
                }
            }
        }
    }
}

// Load existing model type when editing an LLM
export function loadModelBadgeSelection(modelType, skipAttributeAssignment = true) {
    if (!modelType) return;
    
    // Find the badge with matching model type
    const badgeInput = document.querySelector(`.model-badge input[value="${modelType}"]`);
    if (badgeInput) {
        const badge = badgeInput.closest('.model-badge');
        
        // Unselect all badges
        document.querySelectorAll('.model-badge').forEach(b => {
            b.classList.remove('selected');
        });
        
        // Select this badge
        badge.classList.add('selected');
        badgeInput.checked = true;
        
        // Update the hidden select element
        const modelSelect = document.getElementById('llm-model');
        if (modelSelect) {
            modelSelect.value = modelType;
        }
        
        // When editing, we skip attribute assignment by default
        if (!skipAttributeAssignment) {
            import('./modelAttributeDefaults.js').then(module => {
                module.assignDefaultAttributes(modelType, attributeSystem);
                renderAttributeGrid();
                updatePointsDisplay();
            });
        }
    }
}