export const MAX_OUTPUT_TOKENS = 16384;

export function responseMetadata(result) {
  const choice = result?.choices?.[0];
  return {
    finishReason: choice?.finish_reason ?? 'missing',
    contentLength:
      typeof choice?.message?.content === 'string'
        ? choice.message.content.length
        : 0,
    outputTokens: Number(result?.usage?.completion_tokens || 0),
  };
}

export function parseAction(result, observation) {
  const choice = result?.choices?.[0];
  if (choice?.finish_reason === 'length')
    throw Error(
      '模型输出达到长度上限，最终答案被截断。请点击继续重试当前回合。',
    );
  if (!choice || choice.finish_reason !== 'stop')
    throw Error('模型没有正常结束回答，请点击继续重试当前回合。');
  if (
    typeof choice.message?.content !== 'string' ||
    !choice.message.content.trim()
  )
    throw Error('模型返回了空的最终答案，请点击继续重试当前回合。');
  // Strip only a complete surrounding Markdown fence. Never repair truncated JSON
  // or fall back to reasoning_content, which is private model reasoning.
  const content = choice.message.content
    .trim()
    .replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i, '$1');
  let action;
  try {
    action = JSON.parse(content);
  } catch {
    throw Error('模型最终答案不是完整的 JSON 格式，请点击继续重试当前回合。');
  }
  if (!action || Array.isArray(action) || typeof action !== 'object')
    throw Error('模型返回的行动结构不正确，请重试。');
  const speech = [
    'speech',
    'lastWords',
    'wolfChat',
    'sheriffSpeech',
    'preview',
  ].includes(observation.task.type);
  if (speech && (typeof action.text !== 'string' || !action.text.trim()))
    throw Error('模型没有提供有效发言，请重试当前回合。');
  if (!speech && observation.choices.length) {
    if (
      typeof action.choice === 'string' &&
      /^\d+$/.test(action.choice) &&
      observation.choices.includes(Number(action.choice))
    )
      action.choice = Number(action.choice);
    if (!observation.choices.includes(action.choice))
      throw Error('模型选择了不合法的行动目标，请重试当前回合。');
  }
  return {
    text: typeof action.text === 'string' ? action.text.slice(0, 1600) : '',
    choice: action.choice,
    rationale:
      typeof action.rationale === 'string'
        ? action.rationale.slice(0, 1000)
        : '',
  };
}
