import * as THREE from 'three';

// Function to call AI and generate Three.js code for a character
async function generateCharacterCode(userPrompt) {
    try {
        const prompt = `Create Three.js code for a character model based on this description: ${userPrompt}

The code should be a valid JavaScript function that follows this format:
function createCharacter(THREE) {
    const group = new THREE.Group();
    
    // Your generated code goes here
    // Add objects to the group
    
    return group;
}

Important requirements:
1. The character should be centered at origin (0,0,0)
2. Keep the character proportional to a human (about 1.7 units tall)
3. Use only Three.js built-in geometries and materials
4. Return a THREE.Group containing all objects
5. Make sure the code is safe (no fetch, eval, etc.)
6. Be creative with colors and shapes to match the description
7. Give each part a descriptive name using object.name = "PartType_Description" format
8. Use consistent naming like "Head_Main", "Body_Torso", "LeftArm_Upper", "RightLeg_Lower", etc.
9. Position parts appropriately in 3D space with proper parent-child relationships
10. Include at least one head, body/torso, and limbs (arms/legs) in the character

Here are examples of well-structured character parts:
- Head parts: Head_Main, Head_Eyes, Head_Mouth, Head_Ears, Head_Hair
- Body parts: Body_Torso, Body_Chest, Body_Shoulders, Body_Back, Body_Core
- Arm parts: LeftArm_Upper, LeftArm_Lower, LeftArm_Hand, RightArm_Upper, RightArm_Lower, RightArm_Hand
- Leg parts: LeftLeg_Upper, LeftLeg_Lower, LeftLeg_Foot, RightLeg_Upper, RightLeg_Lower, RightLeg_Foot
- Feature parts: Feature_Antenna, Feature_Wings, Feature_Tail, Feature_Accessory

Ensure proper positioning of parts and hierarchical structure where appropriate.`;

        const completion = await websim.chat.completions.create({
            messages: [
                { role: "system", content: "You are an expert Three.js developer who creates visually appealing 3D character models." },
                { role: "user", content: prompt }
            ]
        });

        const codeResponse = completion.content;
        
        // Extract just the function from the response
        const functionMatch = codeResponse.match(/function createCharacter\(THREE\) \{[\s\S]*return group;[\s\S]*\}/);
        if (!functionMatch) {
            throw new Error("Could not find valid function in generated code");
        }
        
        return functionMatch[0];
    } catch (error) {
        console.error("Error generating character code:", error);
        throw error;
    }
}

// Function to evaluate the generated code safely and create the character
function createCustomCharacter(THREE, generatedCode) {
    try {
        // Create a safe function from the generated code
        const createCharacterFn = new Function('THREE', `
            ${generatedCode}
            return createCharacter(THREE);
        `);
        
        // Execute the function with THREE as parameter
        const character = createCharacterFn(THREE);
        
        // Add name labels to each part
        let partIndex = 0;
        character.traverse(child => {
            if (child.isMesh) {
                // Name parts if they don't have names already
                if (!child.name || child.name === '') {
                    const partType = determineMeshType(child);
                    child.name = `${partType}_${partIndex}`;
                    partIndex++;
                }
            }
        });
        
        return character;
    } catch (error) {
        console.error("Error creating custom character:", error);
        return createFallbackCharacter(THREE);
    }
}

// Helper function to determine mesh type based on position and geometry
function determineMeshType(mesh) {
    // Position-based detection
    const position = mesh.position.clone();
    const parent = mesh.parent;
    
    // If parent exists, get world position
    if (parent) {
        parent.updateMatrixWorld();
        position.applyMatrix4(parent.matrixWorld);
    }
    
    // Y-position based detection
    if (position.y > 1.5) {
        return "Head";
    } else if (position.y > 0.8 && position.y < 1.5) {
        return "Body";
    } else if (position.y < 0.8 && position.y > 0) {
        // Check if it's on the side
        if (Math.abs(position.x) > 0.2) {
            return position.x < 0 ? "LeftLimb" : "RightLimb";
        }
        return "Legs";
    } else if (position.y <= 0) {
        return "Base";
    }
    
    // Geometry-based detection fallback
    if (mesh.geometry) {
        if (mesh.geometry.type.includes("Sphere")) {
            return "Head";
        } else if (mesh.geometry.type.includes("Box") || mesh.geometry.type.includes("Cylinder")) {
            return "Body";
        }
    }
    
    return "Part";
}

// Fallback character in case the generated code fails
function createFallbackCharacter(THREE) {
    const group = new THREE.Group();
    
    // Simple robot-like character
    const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.3, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x6495ED })
    );
    head.position.y = 1.5;
    head.name = "Head_Main";
    group.add(head);
    
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.7, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x4169E1 })
    );
    body.position.y = 1.0;
    body.name = "Body_Torso";
    group.add(body);
    
    const leftArm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x4169E1 })
    );
    leftArm.position.set(-0.3, 1.0, 0);
    leftArm.rotation.z = Math.PI / 2;
    leftArm.name = "LeftArm_Upper";
    group.add(leftArm);
    
    const rightArm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x4169E1 })
    );
    rightArm.position.set(0.3, 1.0, 0);
    rightArm.rotation.z = -Math.PI / 2;
    rightArm.name = "RightArm_Upper";
    group.add(rightArm);
    
    const legs = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.15, 0.8),
        new THREE.MeshStandardMaterial({ color: 0x4682B4 })
    );
    legs.position.y = 0.4;
    legs.name = "LeftLeg_Upper";
    group.add(legs);
    
    return group;
}

export { generateCharacterCode, createCustomCharacter };