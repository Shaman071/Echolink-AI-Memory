const fs = require('fs');
const path = require('path');

function parseWhatsApp(text) {
    const messages = [];
    if (!text || typeof text !== 'string') return messages;

    // Normalize line endings and problematic dash characters (em-dash)
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\u2014/g, ' - ');
    const lines = normalized.split('\n');

    // Common WhatsApp date/time patterns for different locales
    // Pattern: [DD/MM/YYYY, HH:MM:SS] or [MM/DD/YYYY, HH:MM:SS] or [DD/MM/YY, HH:MM]
    const patterns = [
        /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]\s*([^:]+):\s*(.+)$/i,
        /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\s*-\s*([^:]+):\s*(.+)$/i,
        /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\s*([^:]+):\s*(.+)$/i,
    ];

    let currentMessage = null;

    console.log(`Parsing ${lines.length} lines...`);

    for (let rawLine of lines) {
        if (!rawLine || !rawLine.trim()) continue;
        const line = rawLine.trim();
        let matched = false;

        // Try each pattern
        for (const pattern of patterns) {
            const match = line.match(pattern);
            if (match) {
                // Save previous message if exists
                if (currentMessage) {
                    messages.push(currentMessage);
                }

                // Parse new message
                const [, date, time, sender, msgText] = match;
                currentMessage = {
                    text: msgText.trim(),
                    sender: sender.trim(),
                    datetime: date + ' ' + time, // Simplified for test
                };
                matched = true;
                break;
            }
        }

        // If no pattern matched, it's a continuation of the previous message
        if (!matched) {
            if (currentMessage) {
                currentMessage.text += '\n' + line;
            } else {
                console.log('No match and no current message for line:', line);
            }
        }
    }

    // Add the last message
    if (currentMessage) {
        messages.push(currentMessage);
    }

    return messages;
}

try {
    const filePath = path.resolve('d:\\Echolink\\sample_data\\sample_whatsapp.txt');
    const content = fs.readFileSync(filePath, 'utf8');
    console.log('File content length:', content.length);
    const messages = parseWhatsApp(content);
    console.log('Parsed messages:', messages.length);
    if (messages.length > 0) {
        console.log('First message:', messages[0]);
    } else {
        console.log('FAILED to parse any messages');
    }
} catch (err) {
    console.error('Error:', err);
}
