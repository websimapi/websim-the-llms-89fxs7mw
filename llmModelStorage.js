// New file for model storage functionality
import * as THREE from 'three';
import { serializeModelData, createStandardMaterials } from './llmCharacterRendererUtils.js';
import { applyStoredTransforms } from './llmMeshManipulator.js';

// Store a model's data completely
export function storeModelData(model, llmData) {
    if (!model) return null;

    // Get serialized model data
    const modelData = serializeModelData(model);

    // Store model data on the LLM
    if (!llmData.modelData) {
        llmData.modelData = {};
    }

    llmData.modelData = modelData;

    // Return the updated LLM data
    return llmData;
}

// Apply stored model data to a character model
export function applyStoredModelData(model, llmData) {
    if (!model || !llmData || !llmData.modelData) return model;

    const modelData = llmData.modelData;

    // Create materials map for quick reference
    const materialsMap = {};

    // Apply stored part data using names for matching
    if (modelData.parts && modelData.parts.length > 0) {
        // Create a map of meshes in the current model by name
        const modelMeshesByName = {};
        model.traverse(child => {
            if (child.isMesh && child.name) {
                modelMeshesByName[child.name] = child;
            } else if (child.isMesh) {
                 console.warn("Mesh found without name during loading:", child);
                 // Attempt to generate the same path-based name used during serialization
                 try {
                    const pathName = getObjectPath(child, model); // Assuming getObjectPath is available or imported
                    if (pathName && !modelMeshesByName[pathName]) { // Check if name isn't already taken
                        child.name = pathName;
                        modelMeshesByName[child.name] = child;
                    }
                 } catch(e){console.error("Error getting path name for unnamed mesh during loading", e)}
            }
        });

        // Iterate through stored part data
        modelData.parts.forEach(partData => {
            const mesh = modelMeshesByName[partData.name];

            if (!mesh) {
                console.warn(`Could not find mesh with name "${partData.name}" in the model during loading.`);
                return; // Skip this part if mesh not found
            }

            // Apply material properties
            if (partData.materialProps) {
                // Create or reuse material
                let material;
                const materialKey = JSON.stringify(partData.materialProps);

                if (materialsMap[materialKey]) {
                    material = materialsMap[materialKey];
                } else {
                    material = createMaterialFromData(partData.materialProps);
                    materialsMap[materialKey] = material;
                }

                mesh.material = material;

                // Update the color picker to match the first colored part
                // This should only happen in the creation UI, maybe move this logic?
                // For now, keep it but check if color picker exists.
                if (partData.name === 'Head_Main' && material.color) { // Example: apply color from head
                    const hexColor = '#' + material.color.getHexString();
                    const colorPicker = document.getElementById('llm-color');
                    if (colorPicker) colorPicker.value = hexColor;
                }
            }

            // Apply stored transformation data if available
            if (partData.transforms) {
                applyStoredTransforms(mesh, partData.transforms);
            } else {
                 // Fallback: Apply position/rotation directly from saved part data if transforms are missing
                 if(partData.position) mesh.position.fromArray(partData.position);
                 if(partData.rotation) mesh.rotation.fromArray(partData.rotation);
            }

            // Ensure the mesh is prepared for potential further manipulation if needed
             if (!mesh.userData.hasUniqueInstance) {
                 mesh.material = mesh.material.clone();
                 mesh.userData.hasUniqueInstance = true;
             }
             if (!mesh.userData.originalColor && mesh.material.color) {
                 mesh.userData.originalColor = mesh.material.color.clone();
             }
             if (mesh.material.emissive && !mesh.userData.originalEmissive) {
                  mesh.userData.originalEmissive = mesh.material.emissive.clone();
              }

        });
    }

    return model;
}


// Helper to get a unique path-based name for an object within a model (copy from utils)
function getObjectPath(object, root) {
    const path = [];
    let current = object;
    while (current && current !== root) {
        path.unshift(current.name || current.type); // Use name or type
        current = current.parent;
    }
    // Filter out empty names and join
    const filteredPath = path.filter(Boolean);
    if (filteredPath.length === 0 && object.name) return object.name; // If root object itself has a name
    if (filteredPath.length === 0) return object.uuid; // Ultimate fallback
    return filteredPath.join('/');
}


// Create a THREE material from serialized data
function createMaterialFromData(materialData) {
    let material;

    switch (materialData.type) {
        case 'MeshStandardMaterial':
            material = new THREE.MeshStandardMaterial();
            break;
        case 'MeshBasicMaterial':
            material = new THREE.MeshBasicMaterial();
            break;
        case 'MeshPhongMaterial':
            material = new THREE.MeshPhongMaterial();
            break;
        default:
            material = new THREE.MeshStandardMaterial();
    }

    // Apply properties
    if (materialData.color) material.color.set(materialData.color);
    if (materialData.emissive) material.emissive.set(materialData.emissive);
    if (materialData.specular && material.specular) material.specular.set(materialData.specular);

    // Apply numeric properties
    const numericProps = ['metalness', 'roughness', 'opacity', 'transparent', 'emissiveIntensity'];
    numericProps.forEach(prop => {
        if (materialData[prop] !== undefined) material[prop] = materialData[prop];
    });

    return material;
}