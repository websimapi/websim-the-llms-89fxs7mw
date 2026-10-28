export const config = {
    // Loading screen settings
    loadingTime: Math.floor(Math.random() * (120000 - 30000 + 1)) + 30000, // Random time between 30s and 2min
    loadingTips: [
        "LLMs need regular prompting to stay happy.",
        "Don't forget to fine-tune your LLMs for better performance.",
        "Hallucinations are a feature, not a bug!",
        "Your LLM's token limit is directly related to their intelligence.",
        "Need more money? Try 'rosebud' in the chat prompt!",
        "Low on GPU? Try reducing your context window.",
        "Different models have different personalities.",
        "Overtraining can lead to model burnout."
    ],

    // Game settings
    startingResources: {
        money: 1000,
        energy: 500
    },

    // City scene settings
    primaryGroundSize: 500, // The size of the main, detailed ground plane
    groundColor: 0x7cfc00,

    // Music player settings
    music: {
        defaultVolume: 2, // 0-4 (OFF, 25%, 50%, 75%, 100%)
        fadeInDuration: 5000, // Increased fade-in duration to 5 seconds
        fadeOutDuration: 3000 // Increased fade-out duration to 3 seconds
    }
};