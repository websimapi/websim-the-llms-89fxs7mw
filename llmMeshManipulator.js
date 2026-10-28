// Helper functions for 3D mesh manipulation
import * as THREE from 'three';

let transformMode = 'none'; // 'none', 'rotate', 'position'
let transformAxis = 'y'; // 'x', 'y', 'z'
let transformStep = 0.05; // Changed from 0.1 to 0.05 for finer control
let transformMultiplier = 1; // For larger/smaller steps

export function initMeshManipulator() {
    // Add event listeners to manipulation buttons
    setupRotationControls();
    setupPositionControls();
    setupValueEditing();
    updateTransformUIState();
}

function setupRotationControls() {
    // X axis rotation
    document.getElementById('rotate-x-minus').addEventListener('click', () => {
        transformMode = 'rotate';
        transformAxis = 'x';
        transformMultiplier = -1;
        updateTransformUIState();
        applyTransform();
    });
    
    document.getElementById('rotate-x-plus').addEventListener('click', () => {
        transformMode = 'rotate';
        transformAxis = 'x';
        transformMultiplier = 1;
        updateTransformUIState();
        applyTransform();
    });
    
    // Y axis rotation
    document.getElementById('rotate-y-minus').addEventListener('click', () => {
        transformMode = 'rotate';
        transformAxis = 'y';
        transformMultiplier = -1;
        updateTransformUIState();
        applyTransform();
    });
    
    document.getElementById('rotate-y-plus').addEventListener('click', () => {
        transformMode = 'rotate';
        transformAxis = 'y';
        transformMultiplier = 1;
        updateTransformUIState();
        applyTransform();
    });
    
    // Z axis rotation
    document.getElementById('rotate-z-minus').addEventListener('click', () => {
        transformMode = 'rotate';
        transformAxis = 'z';
        transformMultiplier = -1;
        updateTransformUIState();
        applyTransform();
    });
    
    document.getElementById('rotate-z-plus').addEventListener('click', () => {
        transformMode = 'rotate';
        transformAxis = 'z';
        transformMultiplier = 1;
        updateTransformUIState();
        applyTransform();
    });
}

function setupPositionControls() {
    // X axis position
    document.getElementById('position-x-minus').addEventListener('click', () => {
        transformMode = 'position';
        transformAxis = 'x';
        transformMultiplier = -1;
        updateTransformUIState();
        applyTransform();
    });
    
    document.getElementById('position-x-plus').addEventListener('click', () => {
        transformMode = 'position';
        transformAxis = 'x';
        transformMultiplier = 1;
        updateTransformUIState();
        applyTransform();
    });
    
    // Y axis position
    document.getElementById('position-y-minus').addEventListener('click', () => {
        transformMode = 'position';
        transformAxis = 'y';
        transformMultiplier = -1;
        updateTransformUIState();
        applyTransform();
    });
    
    document.getElementById('position-y-plus').addEventListener('click', () => {
        transformMode = 'position';
        transformAxis = 'y';
        transformMultiplier = 1;
        updateTransformUIState();
        applyTransform();
    });
    
    // Z axis position
    document.getElementById('position-z-minus').addEventListener('click', () => {
        transformMode = 'position';
        transformAxis = 'z';
        transformMultiplier = -1;
        updateTransformUIState();
        applyTransform();
    });
    
    document.getElementById('position-z-plus').addEventListener('click', () => {
        transformMode = 'position';
        transformAxis = 'z';
        transformMultiplier = 1;
        updateTransformUIState();
        applyTransform();
    });
}

function setupValueEditing() {
    // Make rotation value fields editable
    setupEditableValue('rotation-x-value', 'x', 'rotate');
    setupEditableValue('rotation-y-value', 'y', 'rotate');
    setupEditableValue('rotation-z-value', 'z', 'rotate');
    
    // Make position value fields editable
    setupEditableValue('position-x-value', 'x', 'position');
    setupEditableValue('position-y-value', 'y', 'position');
    setupEditableValue('position-z-value', 'z', 'position');
}

function setupEditableValue(elementId, axis, mode) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    // Add styling to indicate it's editable
    element.style.cursor = 'text';
    element.title = 'Click to edit value';
    
    element.addEventListener('click', function(event) {
        // If an input is already active, don't create a new one
        if (this.querySelector('input')) {
            // Just focus on the existing input
            const existingInput = this.querySelector('input');
            existingInput.focus();
            return;
        }
        
        // Create an input field
        const currentValue = parseFloat(this.textContent);
        const input = document.createElement('input');
        input.type = 'text'; 
        input.value = currentValue.toFixed(2); 
        input.style.width = '70px'; 
        input.style.height = '28px'; 
        input.style.fontSize = '16px'; 
        input.style.backgroundColor = '#333';
        input.style.color = '#3cb371';
        input.style.border = '1px solid #555';
        input.style.borderRadius = '4px';
        input.style.textAlign = 'center';
        input.style.padding = '4px'; 
        
        // Replace the span with the input
        this.textContent = '';
        this.appendChild(input);
        input.focus();
        input.select();
        
        // Stop propagation to prevent immediate blur
        event.stopPropagation();
        
        // Handle input completion
        function completeEdit() {
            if (!input.parentNode) return; // Already removed
            
            let newValue = parseFloat(input.value);
            if (isNaN(newValue)) {
                newValue = currentValue;
            }
            applyManualValue(newValue, axis, mode);
            element.textContent = newValue.toFixed(2);
        }
        
        // Add click handler to the input to prevent propagation
        input.addEventListener('click', function(e) {
            e.stopPropagation();
        });
        
        input.addEventListener('blur', completeEdit);
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                completeEdit();
                e.preventDefault();
            } else if (e.key === 'Escape') {
                element.textContent = currentValue.toFixed(2);
                e.preventDefault();
            }
        });
        
        input.addEventListener('keypress', function(e) {
            const allowedKeys = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '-', '+'];
            if (!allowedKeys.includes(e.key)) {
                e.preventDefault();
            }
        });
    });
}

function applyManualValue(value, axis, mode) {
    const mesh = window.selectedMesh;
    if (!mesh) return;
    
    if (mode === 'rotate') {
        if (axis === 'x') {
            mesh.rotation.x = value;
        } else if (axis === 'y') {
            mesh.rotation.y = value;
        } else if (axis === 'z') {
            mesh.rotation.z = value;
        }
    } 
    else if (mode === 'position') {
        if (axis === 'x') {
            mesh.position.x = value;
        } else if (axis === 'y') {
            mesh.position.y = value;
        } else if (axis === 'z') {
            mesh.position.z = value;
        }
    }
    
    storeTransformData(mesh);
}

function updateTransformUIState() {
    document.querySelectorAll('.control-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (transformMode !== 'none') {
        const selector = `#${transformMode}-${transformAxis}-${transformMultiplier > 0 ? 'plus' : 'minus'}`;
        const activeButton = document.querySelector(selector);
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }
    
    const manipulationControls = document.querySelector('.manipulation-controls');
    const noSelectionMessage = document.querySelector('.no-selection-message');
    
    if (window.selectedMesh) {
        if (manipulationControls) manipulationControls.style.display = 'flex';
        if (noSelectionMessage) noSelectionMessage.style.display = 'none';
    } else {
        if (manipulationControls) manipulationControls.style.display = 'none';
        if (noSelectionMessage) noSelectionMessage.style.display = 'block';
    }
}

export function applyTransform() {
    const mesh = window.selectedMesh;
    if (!mesh) return;
    
    const step = transformStep * transformMultiplier;
    
    if (transformMode === 'rotate') {
        if (transformAxis === 'x') {
            mesh.rotation.x += step;
        } else if (transformAxis === 'y') {
            mesh.rotation.y += step;
        } else if (transformAxis === 'z') {
            mesh.rotation.z += step;
        }
        
        updateRotationDisplay(mesh);
    } 
    else if (transformMode === 'position') {
        if (transformAxis === 'x') {
            mesh.position.x += step;
        } else if (transformAxis === 'y') {
            mesh.position.y += step;
        } else if (transformAxis === 'z') {
            mesh.position.z += step;
        }
        
        updatePositionDisplay(mesh);
    }
    
    storeTransformData(mesh);
}

function updateRotationDisplay(mesh) {
    const xRotDisplay = document.getElementById('rotation-x-value');
    const yRotDisplay = document.getElementById('rotation-y-value');
    const zRotDisplay = document.getElementById('rotation-z-value');
    
    if (xRotDisplay) xRotDisplay.textContent = mesh.rotation.x.toFixed(2);
    if (yRotDisplay) yRotDisplay.textContent = mesh.rotation.y.toFixed(2);
    if (zRotDisplay) zRotDisplay.textContent = mesh.rotation.z.toFixed(2);
}

function updatePositionDisplay(mesh) {
    const xPosDisplay = document.getElementById('position-x-value');
    const yPosDisplay = document.getElementById('position-y-value');
    const zPosDisplay = document.getElementById('position-z-value');
    
    if (xPosDisplay) xPosDisplay.textContent = mesh.position.x.toFixed(2);
    if (yPosDisplay) yPosDisplay.textContent = mesh.position.y.toFixed(2);
    if (zPosDisplay) zPosDisplay.textContent = mesh.position.z.toFixed(2);
}

export function updateManipulationDisplays() {
    const mesh = window.selectedMesh;
    if (!mesh) return;
    
    updateRotationDisplay(mesh);
    updatePositionDisplay(mesh);
    updateTransformUIState();
}

function storeTransformData(mesh) {
    if (!mesh.userData.transforms) {
        mesh.userData.transforms = {};
    }
    
    mesh.userData.transforms.position = {
        x: mesh.position.x,
        y: mesh.position.y,
        z: mesh.position.z
    };
    
    mesh.userData.transforms.rotation = {
        x: mesh.rotation.x,
        y: mesh.rotation.y,
        z: mesh.rotation.z
    };
}

export function applyStoredTransforms(mesh, transformData) {
    if (!mesh || !transformData) return;
    
    if (transformData.position) {
        mesh.position.set(
            transformData.position.x || 0,
            transformData.position.y || 0,
            transformData.position.z || 0
        );
    }
    
    if (transformData.rotation) {
        mesh.rotation.set(
            transformData.rotation.x || 0,
            transformData.rotation.y || 0,
            transformData.rotation.z || 0
        );
    }
    
    mesh.userData.transforms = { ...transformData };
}