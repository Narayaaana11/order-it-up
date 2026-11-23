/**
 * WhatsApp Cloud API Provider Test Suite
 *
 * Verifies that:
 * 1. WhatsAppCloudService sanitizes E.164 phone numbers correctly.
 * 2. Mock mode records and returns valid message IDs for templates and text messages.
 * 3. Required template fields are strictly validated before dispatch.
 * 4. Error responses and invalid recipient formats fail gracefully.
 *
 * Usage: node tests/run-electron-node-test.cjs tests/whatsapp-provider.test.ts
 */

const Module = require('module');
const originalLoad = Module._load;
const fs = require('fs');
const os = require('os');
const path = require('path');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiu-wa-test-'));
Module._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'electron') return { app: { isPackaged: true, getPath: () => testDir, getVersion: () => '1.0.0' } };
  return originalLoad.apply(this, arguments as any);
};

const { WhatsAppCloudService } = require('../main/services/whatsapp-cloud');

let passed = 0;
let failed = 0;
let total = 0;

function assert(condition: boolean, message: string) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

async function main() {
  console.log('=== WhatsApp Cloud API Provider Test Suite ===\n');

  try {
    const waService = new WhatsAppCloudService({ mockMode: true });

    // 1. Phone number sanitization
    console.log('--- 1. Phone Number Sanitization ---');
    assert(waService.sanitizePhoneNumber('+91 98765 43210') === '919876543210', 'Strips spaces and plus sign');
    assert(waService.sanitizePhoneNumber('(91) 98765-43210') === '919876543210', 'Strips parentheses and hyphens');
    assert(waService.sanitizePhoneNumber('919876543210') === '919876543210', 'Keeps raw digits unchanged');

    // 2. Mock Mode Template Dispatch
    console.log('\n--- 2. Template Message Dispatch (Mock Mode) ---');
    const templateResult = await waService.sendTemplate({
      to: '+919876543210',
      templateName: 'order_bill_receipt',
      languageCode: 'en_US',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'Vikram' },
            { type: 'text', text: 'Tandoor Nights' },
            { type: 'text', text: 'ORD-1001' },
            { type: 'text', text: '550.00' },
          ],
        },
      ],
    });

    assert(templateResult.success === true, 'Template send returned success');
    assert(templateResult.mock === true, 'Flagged as mock send');
    assert(typeof templateResult.messageId === 'string', 'Generated messageId string');
    assert(templateResult.messageId.startsWith('wamid.'), 'Message ID follows Meta wamid format');

    const recorded = waService.getRecordedMessages();
    assert(recorded.length === 1, 'Recorded 1 message in service memory');
    assert(recorded[0].type === 'template', 'Recorded message is type template');
    assert(recorded[0].payload.to === '919876543210', 'Recipient digits formatted');

    // 3. Mock Mode Text Dispatch
    console.log('\n--- 3. Direct Text Message Dispatch ---');
    const textResult = await waService.sendText({
      to: '+919876543210',
      body: 'Your table reservation for 4 guests is confirmed at 8:00 PM.',
    });

    assert(textResult.success === true, 'Text send returned success');
    assert(textResult.mock === true, 'Flagged as mock send');
    assert(typeof textResult.messageId === 'string', 'Generated text messageId');

    const recordedAll = waService.getRecordedMessages();
    assert(recordedAll.length === 2, 'Recorded 2 messages total');
    assert(recordedAll[1].type === 'text', 'Second message is type text');

    // 4. Validation & Error Handling
    console.log('\n--- 4. Validation & Edge Cases ---');
    const emptyPhoneResult = await waService.sendTemplate({
      to: '',
      templateName: 'test_template',
    });
    assert(emptyPhoneResult.success === false, 'Empty phone fails with error');
    assert(emptyPhoneResult.error.includes('invalid or empty'), 'Error message describes invalid recipient');

    const emptyTemplateResult = await waService.sendTemplate({
      to: '+919876543210',
      templateName: '',
    });
    assert(emptyTemplateResult.success === false, 'Empty templateName fails with error');
    assert(emptyTemplateResult.error.includes('templateName is required'), 'Error message flags templateName');

    const emptyBodyResult = await waService.sendText({
      to: '+919876543210',
      body: '',
    });
    assert(emptyBodyResult.success === false, 'Empty body text fails with error');
    assert(emptyBodyResult.error.includes('cannot be empty'), 'Error message flags empty body');

    // Clear history
    waService.clearRecordedMessages();
    assert(waService.getRecordedMessages().length === 0, 'clearRecordedMessages empties recorded list');

    console.log('\nAll WhatsApp Cloud API tests passed successfully!');
  } catch (err: any) {
    console.error('Test execution failed:', err);
    failed++;
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed of ${total} assertions`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
