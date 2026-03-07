const { parseWhatsApp, parseWhatsAppDate } = require('../src/services/parser.service');

describe('WhatsApp Parser', () => {
    describe('Date Parsing', () => {
        it('should parse DD/MM/YYYY, HH:MM format', () => {
            const date = parseWhatsAppDate('07/12/2025', '18:30');
            expect(date).toBeInstanceOf(Date);
            expect(date.getDate()).toBe(7);
            expect(date.getMonth()).toBe(11); // December is month 11
            expect(date.getFullYear()).toBe(2025);
        });

        it('should parse DD/MM/YY, HH:MM format', () => {
            const date = parseWhatsAppDate('07/12/25', '18:30');
            expect(date).toBeInstanceOf(Date);
            expect(date.getFullYear()).toBe(2025);
        });

        it('should parse MM/DD/YYYY format (US)', () => {
            const date = parseWhatsAppDate('12/07/2025', '6:30 PM');
            expect(date).toBeInstanceOf(Date);
        });
    });

    describe('Message Parsing', () => {
        it('should parse standard WhatsApp format', () => {
            const text = `[07/12/2025, 18:30:45] John: Hello, how are you?
[07/12/2025, 18:31:12] Alice: I'm good, thanks!
[07/12/2025, 18:32:00] John: Great to hear!`;

            const messages = parseWhatsApp(text);

            expect(messages).toHaveLength(3);
            expect(messages[0]).toHaveProperty('text');
            expect(messages[0]).toHaveProperty('sender');
            expect(messages[0]).toHaveProperty('datetime');

            expect(messages[0].sender).toBe('John');
            expect(messages[0].text).toContain('Hello, how are you?');

            expect(messages[1].sender).toBe('Alice');
            expect(messages[1].text).toContain("I'm good, thanks!");
        });

        it('should handle multiline messages', () => {
            const text = `[07/12/2025, 18:30:00] John: This is a long message
that spans multiple lines
and continues here`;

            const messages = parseWhatsApp(text);

            expect(messages).toHaveLength(1);
            expect(messages[0].text).toContain('This is a long message');
            expect(messages[0].text).toContain('multiple lines');
            expect(messages[0].text).toContain('continues here');
        });

        it('should handle messages with special characters', () => {
            const text = `[07/12/2025, 18:30:00] John: Check this link: https://example.com
[07/12/2025, 18:30:30] Alice: Nice! $100 sounds good 😊`;

            const messages = parseWhatsApp(text);

            expect(messages).toHaveLength(2);
            expect(messages[0].text).toContain('https://example.com');
            expect(messages[1].text).toContain('$100');
            expect(messages[1].text).toContain('😊');
        });

        it('should handle system messages', () => {
            const text = `[07/12/2025, 18:00:00] Messages and calls are end-to-end encrypted
[07/12/2025, 18:30:00] John: Hello everyone!`;

            const messages = parseWhatsApp(text);

            // Should still parse system messages, just with "Unknown" sender
            expect(messages.length).toBeGreaterThan(0);
        });

        it('should handle different date formats', () => {
            const formats = [
                `[12/7/2025, 6:30:00 PM] John: US format`,
                `[07/12/2025, 18:30:00] John: European format`,
                `[2025-12-07, 18:30:00] John: ISO format`,
            ];

            formats.forEach(text => {
                const messages = parseWhatsApp(text);
                expect(messages.length).toBeGreaterThan(0);
                expect(messages[0].sender).toBe('John');
            });
        });

        it('should handle empty or invalid input', () => {
            expect(parseWhatsApp('')).toEqual([]);
            expect(parseWhatsApp('Random text without format')).toEqual([]);
            expect(parseWhatsApp(null)).toEqual([]);
            expect(parseWhatsApp(undefined)).toEqual([]);
        });

        it('should handle messages with colons in content', () => {
            const text = `[07/12/2025, 18:30:00] John: The meeting time is: 2:00 PM`;

            const messages = parseWhatsApp(text);

            expect(messages).toHaveLength(1);
            expect(messages[0].sender).toBe('John');
            expect(messages[0].text).toBe('The meeting time is: 2:00 PM');
        });
    });

    describe('Real-world Sample', () => {
        it('should parse the sample_whatsapp.txt format', () => {
            const text = `[11/13/2024, 10:15:32 AM] Alice: Hey everyone! Ready for the code review?
[11/13/2024, 10:16:05 AM] Bob: Yes, I've finished the React components
[11/13/2024, 10:16:42 AM] Charlie: Almost done with the backend API
[11/13/2024, 10:17:15 AM] Alice: Great! Let's discuss the authentication flow
[11/13/2024, 10:18:03 AM] Bob: I implemented JWT tokens with refresh logic
[11/13/2024, 10:19:21 AM] Charlie: The database models are all set up
Should we use MongoDB or PostgreSQL?
[11/13/2024, 10:20:11 AM] Alice: MongoDB works well for this project
[11/13/2024, 10:21:45 AM] Bob: Agreed. The schema is flexible enough`;

            const messages = parseWhatsApp(text);

            expect(messages.length).toBeGreaterThan(5);

            // Check specific messages
            const aliceMessages = messages.filter(m => m.sender === 'Alice');
            const bobMessages = messages.filter(m => m.sender === 'Bob');
            const charlieMessages = messages.filter(m => m.sender === 'Charlie');

            expect(aliceMessages.length).toBeGreaterThan(0);
            expect(bobMessages.length).toBeGreaterThan(0);
            expect(charlieMessages.length).toBeGreaterThan(0);

            // Check multiline message
            const charlieMultiline = messages.find(m =>
                m.sender === 'Charlie' && m.text.includes('Should we use')
            );
            expect(charlieMultiline).toBeDefined();
            expect(charlieMultiline.text).toContain('PostgreSQL');
        });
    });

    describe('Edge Cases', () => {
        it('should handle messages with just emojis', () => {
            const text = `[07/12/2025, 18:30:00] John: 😊😊😊`;

            const messages = parseWhatsApp(text);
            expect(messages).toHaveLength(1);
            expect(messages[0].text).toBe('😊😊😊');
        });

        it('should handle very long messages', () => {
            const longText = 'A'.repeat(10000);
            const text = `[07/12/2025, 18:30:00] John: ${longText}`;

            const messages = parseWhatsApp(text);
            expect(messages).toHaveLength(1);
            expect(messages[0].text).toHaveLength(10000);
        });

        it('should handle messages with attachment indicators', () => {
            const text = `[07/12/2025, 18:30:00] John: <attached: 1 image>
[07/12/2025, 18:31:00] Alice: Got it!`;

            const messages = parseWhatsApp(text);
            expect(messages.length).toBeGreaterThan(0);
        });
    });
});
