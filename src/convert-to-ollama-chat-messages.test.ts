import { convertToOllamaChatMessages } from './convert-to-ollama-chat-messages';

describe('system messages', () => {
  it('should forward system messages', async () => {
    const result = convertToOllamaChatMessages({
      prompt: [{ role: 'system', content: 'You are a helpful assistant.' }],
    });

    expect(result).toEqual([
      { role: 'system', content: 'You are a helpful assistant.' },
    ]);
  });

  it('should convert system messages to developer messages when requested', async () => {
    const result = convertToOllamaChatMessages({
      prompt: [{ role: 'system', content: 'You are a helpful assistant.' }],
      systemMessageMode: 'developer',
    });

    expect(result).toEqual([
      { role: 'developer', content: 'You are a helpful assistant.' },
    ]);
  });

  it('should remove system messages when requested', async () => {
    const result = convertToOllamaChatMessages({
      prompt: [{ role: 'system', content: 'You are a helpful assistant.' }],
      systemMessageMode: 'remove',
    });

    expect(result).toEqual([]);
  });
});

describe('user messages', () => {
  it('should convert messages with only a text part to a string content', async () => {
    const result = convertToOllamaChatMessages({
      prompt: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Hello' }],
        },
      ],
    });

    expect(result).toEqual([{ role: 'user', content: 'Hello' }]);
  });

  it('should convert messages with image parts', async () => {
    const result = convertToOllamaChatMessages({
      prompt: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Hello' },
            {
              type: 'image',
              image: new Uint8Array([0, 1, 2, 3]),
              mimeType: 'image/png',
            },
          ],
        },
      ],
    });

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Hello' },
          {
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,AAECAw==' },
          },
        ],
      },
    ]);
  });

  it('should add image detail when specified through extension', async () => {
    const result = convertToOllamaChatMessages({
      prompt: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              image: new Uint8Array([0, 1, 2, 3]),
              mimeType: 'image/png',
              providerMetadata: {
                ollama: {
                  imageDetail: 'low',
                },
              },
            },
          ],
        },
      ],
    });

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: 'data:image/png;base64,AAECAw==',
              detail: 'low',
            },
          },
        ],
      },
    ]);
  });

  describe('file parts', () => {
    it('should throw for unsupported mime types', () => {
      expect(() =>
        convertToOllamaChatMessages({
          prompt: [
            {
              role: 'user',
              content: [
                { type: 'file', data: 'AAECAw==', mimeType: 'image/png' },
              ],
            },
          ],
        }),
      ).toThrow(
        "'File content part type image/png in user messages' functionality not supported.",
      );
    });

    it('should throw for URL data', () => {
      expect(() =>
        convertToOllamaChatMessages({
          prompt: [
            {
              role: 'user',
              content: [
                {
                  type: 'file',
                  data: new URL('https://example.com/foo.wav'),
                  mimeType: 'audio/wav',
                },
              ],
            },
          ],
        }),
      ).toThrow(
        "'File content parts with URL data' functionality not supported.",
      );
    });

    it('should add audio content for audio/wav file parts', () => {
      const result = convertToOllamaChatMessages({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                data: 'AAECAw==',
                mimeType: 'audio/wav',
              },
            ],
          },
        ],
      });

      expect(result).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'input_audio',
              input_audio: { data: 'AAECAw==', format: 'wav' },
            },
          ],
        },
      ]);
    });

    it('should add audio content for audio/mpeg file parts', () => {
      const result = convertToOllamaChatMessages({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                data: 'AAECAw==',
                mimeType: 'audio/mpeg',
              },
            ],
          },
        ],
      });

      expect(result).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'input_audio',
              input_audio: { data: 'AAECAw==', format: 'mp3' },
            },
          ],
        },
      ]);
    });

    it('should add audio content for audio/mp3 file parts', () => {
      const result = convertToOllamaChatMessages({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                data: 'AAECAw==',
                mimeType: 'audio/mp3', // not official but sometimes used
              },
            ],
          },
        ],
      });

      expect(result).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'input_audio',
              input_audio: { data: 'AAECAw==', format: 'mp3' },
            },
          ],
        },
      ]);
    });
  });
});

describe('assistant messages', () => {
  it('should handle reasoning parts in assistant content', () => {
    const result = convertToOllamaChatMessages({
      prompt: [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me think about this.' },
            { type: 'reasoning', text: 'This is my reasoning process.' },
            { type: 'text', text: ' The answer is 42.' },
          ],
        },
      ],
    });

    expect(result).toEqual([
      {
        role: 'assistant',
        content: 'Let me think about this. The answer is 42.',
        thinking: 'This is my reasoning process.',
      },
    ]);
  });
});

describe('tool calls', () => {
  it('should stringify arguments to tool calls', () => {
    const result = convertToOllamaChatMessages({
      prompt: [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              args: { foo: 'bar123' },
              toolCallId: 'quux',
              toolName: 'thwomp',
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'quux',
              toolName: 'thwomp',
              result: { oof: '321rab' },
            },
          ],
        },
      ],
    });

    expect(result).toEqual([
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            type: 'function',
            id: 'quux',
            function: {
              name: 'thwomp',
              arguments: JSON.stringify({ foo: 'bar123' }),
            },
          },
        ],
      },
      {
        role: 'tool',
        content: JSON.stringify({ oof: '321rab' }),
        tool_call_id: 'quux',
      },
    ]);
  });

  it('should convert tool calls to function calls with useLegacyFunctionCalling', () => {
    const result = convertToOllamaChatMessages({
      prompt: [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              args: { foo: 'bar123' },
              toolCallId: 'quux',
              toolName: 'thwomp',
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'quux',
              toolName: 'thwomp',
              result: { oof: '321rab' },
            },
          ],
        },
      ],
      useLegacyFunctionCalling: true,
    });

    expect(result).toEqual([
      {
        role: 'assistant',
        content: '',
        function_call: {
          name: 'thwomp',
          arguments: JSON.stringify({ foo: 'bar123' }),
        },
      },
      {
        role: 'function',
        content: JSON.stringify({ oof: '321rab' }),
        name: 'thwomp',
      },
    ]);
  });
});
