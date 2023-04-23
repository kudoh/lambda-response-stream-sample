import * as AWS from '@aws-sdk/client-ssm';
import { Configuration, OpenAIApi } from 'openai';
import { IncomingMessage } from 'http';

import { pipeline as pipelineSync, Transform, TransformOptions } from 'stream';
import { promisify } from 'util';
const pipeline = promisify(pipelineSync);

// OpenAIのストリームレスポンスをChatメッセージに変換するカスタムTransformer
class ChunkTransformer extends Transform {
  constructor(options?: TransformOptions) {
    super(options);
  }
  _transform(chunk: Buffer, encoding: BufferEncoding, callback: (error?: Error | null, data?: any) => void): void {
    const payloads = chunk.toString().split('\n\n');
    for (const payload of payloads) {
      if (payload.includes('[DONE]')) {
        break;
      }
      if (payload.startsWith('data:')) {
        const data = payload.replaceAll(/(\n)?^data:\s*/g, '');
        try {
          const delta = JSON.parse(data.trim());
          this.push(delta.choices[0].delta?.content || '');
        } catch (error) {
          console.log(error);
        }
      }
    }
    callback();
  }
}

// SSMパラメータストアからAPIキーを取得
const ssmClient = new AWS.SSM({});
const ssmParam = ssmClient.getParameter({ Name: '/openai/api-key', WithDecryption: true });

// Lambdaイベントハンドラー本体
export const lambdaHandler = awslambda.streamifyResponse(async (event, responseStream, context) => {
  const json = JSON.parse(event.body || '{}');
  if (!json.message) {
    responseStream.write('no message');
    responseStream.end();
    return;
  }

  try {
    // OpenAI APIの実行
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
      stream: true // enable stream
    }, {
      responseType: 'stream' // axios option(required)
    });

    // Node.jsのPipelineに連携
    const stream = response.data as unknown as IncomingMessage;
    await pipeline(stream, new ChunkTransformer(), responseStream);
  } catch (err) {
    console.log(err);
    responseStream.write('エラーが発生しました！');
    responseStream.end();
  }
});
