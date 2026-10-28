import * as THREE from 'three';

// Capture a snapshot of the current 3D model in the scene
export async function captureModelSnapshot(scene, camera, renderer) {
    // Ensure renderer size matches the canvas for proper capture
    const originalSize = {
        width: renderer.domElement.width,
        height: renderer.domElement.height
    };
    
    // Render the scene to capture it
    renderer.render(scene, camera);
    
    // Get the image data URL from the canvas
    const imageDataUrl = renderer.domElement.toDataURL('image/png');
    
    return imageDataUrl;
}

// Generate a profile image based on the snapshot and description
export async function generateProfileImage(imageDataUrl, description) {
    try {
        // First, analyze the image to understand what's in it
        const imageAnalysis = await analyzeModelImage(imageDataUrl);
        
        // Combine image analysis with user description for better context
        const enhancedPrompt = createEnhancedPrompt(imageAnalysis, description);
        
        // Generate the actual profile image using the enhanced prompt
        const result = await websim.imageGen({
            prompt: enhancedPrompt,
            aspect_ratio: "1:1",
            seed: Math.floor(Math.random() * 1000) // Random seed for variety
        });
        
        return { 
            success: true, 
            url: result.url,
            prompt: enhancedPrompt
        };
    } catch (error) {
        console.error("Error generating profile image:", error);
        return { 
            success: false, 
            error: error.message 
        };
    }
}

// Analyze the model image to understand what it contains
async function analyzeModelImage(imageDataUrl) {
    try {
        const completion = await websim.chat.completions.create({
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Describe this 3D character model in detail. Focus on its appearance, colors, structure, and any distinctive features. Format your response as a concise paragraph describing only what you see."
                        },
                        {
                            type: "image_url",
                            image_url: { url: imageDataUrl }
                        }
                    ]
                }
            ]
        });
        
        return completion.content;
    } catch (error) {
        console.error("Error analyzing image:", error);
        return "A 3D character model";
    }
}

// Create an enhanced prompt by combining the image analysis and user description
function createEnhancedPrompt(imageAnalysis, userDescription) {
    return `Create a vibrant profile image for this character: ${userDescription}
    
The 3D model looks like: ${imageAnalysis}

Create a polished, well-lit portrait style image that showcases this character with a simple background. Make it look like professional artwork for a video game or animation character.`;
}