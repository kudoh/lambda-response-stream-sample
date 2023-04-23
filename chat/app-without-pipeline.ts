import * as AWS from '@aws-sdk/client-ssm';
import { Configuration, OpenAIApi } from 'openai';
import { IncomingMessage } from 'http';

const ssmClient = new AWS.SSM({});
const ssmParam = ssmClient.getParameter({ Name: '/openai/api-key', WithDecryption: true });

export const lambdaHandler = awslambda.streamifyResponse(async (event, responseStream, context) => {
  const json = JSON.parse(event.body || '{}');
  if (!json.message) {
    responseStream.write('no message');
    responseStream.end();
    return;
  }

  try {
    const apiKey = (await ssmParam).Parameter?.Value || '';
    const configuration = new Configuration({
      apiKey
    });
    const openai = new OpenAIApi(configuration);
    const response = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [{
        role: 'user',
        content: json.message
      }],
      max_tokens: 1024,
      temperature: 0.7,
      stream: true
    }, {
      responseType: 'stream'
    });
    const stream = response.data as unknown as IncomingMessage;

    stream.on('data', (chunk: Buffer) => {
      console.log(chunk.toString());
      const payloads = chunk.toString().split('\n\n');
      for (const payload of payloads) {
        if (payload.includes('[DONE]')) return; // end of stream
        if (payload.startsWith('data:')) {
          const data = payload.replaceAll(/(\n)?^data:\s*/g, '');
          const delta = JSON.parse(data.trim());
          console.log(delta.choices[0].delta?.content);
          responseStream.write(delta.choices[0].delta?.content || '');
        }
      }
    });

    stream.on('end', () => {
      console.log('Stream done');
      responseStream.end();
    });
    stream.on('error', (e: Error) => {
      console.error(e);
      responseStream.write('ストリームエラーが発生しました');
      responseStream.end();
    });
  } catch (err) {
    console.log(err);
    responseStream.write('APIエラーが発生しました！');
    responseStream.end();
  }
});

