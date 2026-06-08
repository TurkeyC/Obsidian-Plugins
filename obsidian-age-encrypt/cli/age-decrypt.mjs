#!/usr/bin/env node

import { Decrypter } from 'age-encryption';
import { readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';
import { argv, exit, stdout } from 'process';

const AGE_BLOCK_REGEX = /```age\n(?:hint: .+\n)?-----BEGIN AGE ENCRYPTED FILE-----\n([\s\S]*?)-----END AGE ENCRYPTED FILE-----\n```/g;

function parseArgs() {
    const args = {
        password: null,
        output: null,
        mode: 'extract-all',
        file: null,
    };

    const rawArgs = argv.slice(2);
    for (let i = 0; i < rawArgs.length; i++) {
        switch (rawArgs[i]) {
            case '-p':
            case '--password':
                args.password = rawArgs[++i];
                break;
            case '-o':
            case '--output':
                args.output = rawArgs[++i];
                break;
            case '--decrypt-file':
                args.mode = 'decrypt-file';
                break;
            case '--extract-all':
                args.mode = 'extract-all';
                break;
            default:
                if (!rawArgs[i].startsWith('-')) {
                    args.file = rawArgs[i];
                }
                break;
        }
    }

    return args;
}

function base64ToArrayBuffer(base64) {
    const clean = base64.replace(/\n/g, '');
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

async function promptPassword() {
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question('Enter decryption password: ', (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

function parseEncryptedBlock(source) {
    const lines = source
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('```'));

    let hint = undefined;
    let contentStartIndex = 0;

    if (lines[0] && lines[0].startsWith('hint: ')) {
        hint = lines[0].substring(6);
        contentStartIndex = 1;
    }

    const beginIndex = lines.findIndex(l => l === '-----BEGIN AGE ENCRYPTED FILE-----');
    const endIndex = lines.findIndex(l => l === '-----END AGE ENCRYPTED FILE-----');

    if (beginIndex === -1 || endIndex === -1 || beginIndex >= endIndex) {
        throw new Error('Invalid block: missing age markers');
    }

    const content = lines.slice(beginIndex + 1, endIndex).join('\n');
    if (!content) {
        throw new Error('Invalid block: no content found');
    }

    return { content, hint };
}

async function decryptBlock(encryptedContent, password) {
    const decrypter = new Decrypter();
    decrypter.addPassphrase(password);
    const encryptedArray = base64ToArrayBuffer(encryptedContent);
    return await decrypter.decrypt(encryptedArray, "text");
}

function printUsage() {
    console.log(`
Usage: node age-decrypt.mjs [options] <file.md>

Options:
  -p, --password <pw>    Provide password directly (will prompt if omitted)
  -o, --output <file>    Write output to file instead of stdout
  --decrypt-file         Decrypt the entire file content as a single block
  --extract-all          Extract and decrypt all \`\`\`age blocks in the file
                         (this is the default mode)
`);
}

async function main() {
    const args = parseArgs();

    if (!args.file) {
        console.error('Error: No file specified');
        printUsage();
        exit(1);
    }

    // Read file
    let content;
    try {
        content = readFileSync(args.file, 'utf-8');
    } catch (err) {
        console.error(`Error reading file: ${err.message}`);
        exit(1);
    }

    // Get password
    const password = args.password || await promptPassword();
    if (!password) {
        console.error('Error: Password is required');
        exit(1);
    }

    const outputLines = [];

    if (args.mode === 'decrypt-file') {
        // Find the first ```age block and decrypt it as the whole file content
        AGE_BLOCK_REGEX.lastIndex = 0;
        const match = AGE_BLOCK_REGEX.exec(content);

        if (!match) {
            console.error('Error: No encrypted block found in file');
            exit(1);
        }

        // Also check for frontmatter before the block
        let frontmatter = '';
        const fmMatch = content.match(/^---\n[\s\S]*?\n---\n/);
        if (fmMatch) {
            frontmatter = fmMatch[0];
        }

        const { content: encryptedContent } = parseEncryptedBlock(match[0]);
        try {
            const decrypted = await decryptBlock(encryptedContent, password);
            outputLines.push(frontmatter + decrypted);
        } catch (err) {
            console.error('Decryption failed: wrong password or corrupted data');
            exit(1);
        }
    } else {
        // Extract and decrypt all ```age blocks
        AGE_BLOCK_REGEX.lastIndex = 0;
        let match;
        let found = false;

        while ((match = AGE_BLOCK_REGEX.exec(content)) !== null) {
            found = true;
            try {
                const { content: encryptedContent, hint } = parseEncryptedBlock(match[0]);
                const decrypted = await decryptBlock(encryptedContent, password);
                outputLines.push(`--- Decrypted block${hint ? ` (hint: ${hint})` : ''} ---`);
                outputLines.push(decrypted);
                outputLines.push('--- End ---');
            } catch (err) {
                outputLines.push(`--- Block decryption failed: wrong password or corrupted data ---`);
            }
        }

        if (!found) {
            console.log('No encrypted blocks found in file.');
            exit(0);
        }
    }

    const output = outputLines.join('\n') + '\n';

    if (args.output) {
        try {
            writeFileSync(args.output, output, 'utf-8');
            console.log(`Output written to ${args.output}`);
        } catch (err) {
            console.error(`Error writing output: ${err.message}`);
            exit(1);
        }
    } else {
        stdout.write(output);
    }
}

main().catch(err => {
    console.error(`Error: ${err.message}`);
    exit(1);
});
