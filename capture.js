document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    lucide.createIcons();

    // OpenRouter API Configuration
    const OPENROUTER_API_KEY = "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";
    const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
    const MODEL = "meta-llama/llama-3.2-11b-vision-instruct:free";

    // DOM Elements
    const video = document.getElementById('webcam');
    const canvas = document.getElementById('canvas');
    const capturedImage = document.getElementById('capturedImage');
    const captureBtn = document.getElementById('captureBtn');
    const retakeBtn = document.getElementById('retakeBtn');
    const questionPopup = document.getElementById('questionPopup');
    const closePopupBtn = document.getElementById('closePopup');
    const popupBody = document.querySelector('.popup-body');

    let stream;
    let currentImageData = null;

    async function startCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } 
            });
            video.srcObject = stream;
            await video.play();
            captureBtn.disabled = false;
        } catch (err) {
            console.error("Error accessing the camera", err);
            alert("Camera access denied. Please enable camera permissions and refresh the page.");
        }
    }

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    }

    function capture() {
        const aspectRatio = video.videoWidth / video.videoHeight;
        const targetWidth = Math.min(800, video.videoWidth);
        const targetHeight = targetWidth / aspectRatio;

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        return canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
    }

    async function analyzeImage(imageBase64) {
        try {
            console.log('Sending request to OpenRouter...');
            const requestBody = {
                model: MODEL,
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "Analyze the image using logical reasoning and provide a detailed response, even if you're uncertain about some aspects. Do not use asterisks for formatting. Examine the object in the image as a waste item and answer the following: Identify the item and specify the type of waste it represents. Explain how it should be properly disposed of. Describe its environmental impact, including: The exact CO2 emissions in kg, formatted as $ X.XX $ The appropriate disposal bin, using one of these tags: $ RECYCLE $ for recyclable items $COMPOST$ for compostable items $TRASH$ for items that go in the general waste bin Your response should follow this structure: [Item name] is [type of waste]. It should be disposed of by [disposal method]. This item has an environmental impact of $X.XX$ kg of CO2 emissions. It belongs in the $[BIN TYPE]$ bin. Provide your best estimate for all requested information, even if you're not entirely certain. Ensure you address all parts of the question in your response."
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/jpeg;base64,${imageBase64}`
                                }
                            }
                        ]
                    }
                ]
            };

            console.log('Making request...');

            const response = await fetch(OPENROUTER_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'Waste Analysis App',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();
            console.log('Response received:', data);

            if (!response.ok) {
                throw new Error(data.error?.message || 'Failed to analyze image');
            }

            if (!data.choices?.[0]?.message?.content) {
                throw new Error('No response from AI');
            }

            const aiResponse = data.choices[0].message.content.trim();
            console.log('AI Response:', aiResponse);

            // Extract CO2 value - look for numbers followed by kg or numbers alone
            let co2Value = 0;
            const kgMatch = aiResponse.match(/(\d+(?:\.\d+)?)\s*kg/);
            if (kgMatch) {
                co2Value = parseFloat(kgMatch[1]);
            } else {
                // If no kg match, look for any number after "approximately" or near "CO2"
                const numMatch = aiResponse.match(/approximately\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?=.*CO2)/);
                if (numMatch) {
                    co2Value = parseFloat(numMatch[1] || numMatch[2]);
                }
            }

            // Parse the response into sections
            const sections = {
                itemType: "Not identified",
                disposalMethod: "Not specified",
                co2Impact: co2Value ? `${co2Value} kg` : "Not calculated",
                co2Value: co2Value,
                fullAnalysis: aiResponse
            };

            // Try to extract item type
            const typeMatch = aiResponse.match(/(?:1\.|type of waste[:\s]+)([^.]+)/i);
            if (typeMatch) sections.itemType = typeMatch[1].trim();

            return sections;
        } catch (error) {
            console.error('Analysis error:', error);
            throw error;
        }
    }

    captureBtn.addEventListener('click', async () => {
        try {
            currentImageData = capture();
            video.hidden = true;
            capturedImage.src = `data:image/jpeg;base64,${currentImageData}`;
            capturedImage.hidden = false;
            captureBtn.hidden = true;
            retakeBtn.hidden = false;
            
            // Show popup with loading state
            questionPopup.style.display = 'flex';
            popupBody.innerHTML = '<div class="loading">Analyzing your waste item...</div>';
            
            console.log('Sending image for analysis...');
            const analysis = await analyzeImage(currentImageData);
            
            // Display the analysis results
            const resultHtml = `
                <div class="analysis-result">
                    <div class="analysis-section">
                        <h3>Type of Waste</h3>
                        <p>${analysis.itemType}</p>
                    </div>
                    <div class="analysis-section">
                        <h3>Disposal Method</h3>
                        <p>${analysis.disposalMethod}</p>
                    </div>
                    <div class="analysis-section">
                        <h3>Environmental Impact</h3>
                        <p>${analysis.co2Impact} CO2</p>
                    </div>
                    <div class="analysis-section">
                        <h3>Full Analysis</h3>
                        <p>${analysis.fullAnalysis}</p>
                    </div>
                    <button id="validateBtn" class="btn btn-primary" style="margin-top: 1rem;">
                        <i data-lucide="check-circle"></i>
                        Validate Analysis
                    </button>
                </div>
            `;

            // Clear loading message and show results
            popupBody.innerHTML = resultHtml;
            questionPopup.style.display = 'flex';

            // Initialize Lucide icons for the new button
            lucide.createIcons();

            // Add validate button handler
            const validateBtn = document.getElementById('validateBtn');
            validateBtn.addEventListener('click', async () => {
                try {
                    validateBtn.disabled = true;
                    validateBtn.innerHTML = '<i data-lucide="loader"></i> Updating...';
                    lucide.createIcons();

                    if (!analysis.co2Value) {
                        throw new Error('No CO2 value found in analysis');
                    }

                    const userEmail = localStorage.getItem('userEmail');
                    if (!userEmail) {
                        throw new Error('User not logged in');
                    }

                    // Extract CO2 value from the analysis
                    const co2Match = analysis.fullAnalysis.match(/(\d+\.?\d*)\s*kg/);
                    const co2Value = co2Match ? parseFloat(co2Match[1]) : 0;

                    if (!co2Value) {
                        throw new Error('Could not extract CO2 value');
                    }

                    // Read current emissions.json
                    const response = await fetch('/emissions.json');
                    if (!response.ok) {
                        throw new Error('Failed to read emissions data');
                    }

                    const data = await response.json();
                    
                    // Initialize user if not exists
                    if (!data.users[userEmail]) {
                        data.users[userEmail] = { emissions: [] };
                    }
                    
                    // Add new emission
                    data.users[userEmail].emissions.push(co2Value);
                    
                    // Calculate total
                    const total = data.users[userEmail].emissions.reduce((sum, val) => sum + val, 0);
                    
                    // Save to emissions.json
                    const writeResponse = await fetch('/save-emissions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(data)
                    });

                    if (!writeResponse.ok) {
                        throw new Error('Failed to save emissions data');
                    }

                    // Update local storage with new total
                    localStorage.setItem('co2Emissions', total.toString());

                    // Update button to show success
                    validateBtn.className = 'btn btn-success';
                    validateBtn.innerHTML = '<i data-lucide="check"></i> Updated Successfully';
                    lucide.createIcons();

                    // Add to recent activity if on dashboard
                    const recentPhotos = document.getElementById('recentPhotos');
                    if (recentPhotos) {
                        const activityHtml = `
                            <div class="activity-item">
                                <div class="activity-image">
                                    <img src="data:image/jpeg;base64,${currentImageData}" alt="Analyzed waste item">
                                </div>
                                <div class="activity-details">
                                    <h4>${analysis.itemType}</h4>
                                    <p>${analysis.disposalMethod}</p>
                                    <p class="co2-impact">+${co2Value} kg CO2</p>
                                </div>
                            </div>
                        `;
                        recentPhotos.innerHTML = activityHtml + recentPhotos.innerHTML;
                    }

                } catch (error) {
                    console.error('Validation error:', error);
                    validateBtn.className = 'btn btn-error';
                    validateBtn.innerHTML = '<i data-lucide="alert-triangle"></i> Error: ' + error.message;
                    lucide.createIcons();
                    validateBtn.disabled = false;
                }
            });

            // Add to recent activity (if needed)
            const recentPhotos = document.getElementById('recentPhotos');
            if (recentPhotos) {
                const activityHtml = `
                    <div class="activity-item">
                        <div class="activity-image">
                            <img src="data:image/jpeg;base64,${currentImageData}" alt="Analyzed waste item">
                        </div>
                        <div class="activity-details">
                            <h4>${analysis.itemType}</h4>
                            <p>${analysis.disposalMethod}</p>
                        </div>
                    </div>
                `;
                recentPhotos.innerHTML = activityHtml + recentPhotos.innerHTML;
            }
        } catch (error) {
            console.error('Analysis failed:', error);
            popupBody.innerHTML = `
                <div class="error">
                    <h3>Analysis Failed</h3>
                    <p>${error.message}</p>
                    <button onclick="location.reload()" class="retry-btn">Try Again</button>
                </div>
            `;
        }
    });

    retakeBtn.addEventListener('click', () => {
        video.hidden = false;
        capturedImage.hidden = true;
        captureBtn.hidden = false;
        retakeBtn.hidden = true;
        questionPopup.style.display = 'none';
        currentImageData = null;
    });

    // Close popup when clicking X button
    closePopupBtn.addEventListener('click', () => {
        questionPopup.style.display = 'none';
    });

    // Start camera
    startCamera();

    // Cleanup on page unload
    window.addEventListener('beforeunload', stopCamera);
});

