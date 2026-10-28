import { optionLabel, optionLetter } from './options.js';
/** 题目在卡片请求里的稳定 id。 */
export function questionId(index) {
    return `q${index + 1}`;
}
/**
 * 由卡片回传的 id 反查题目下标。
 * @param id - 请求里发出去的题目 id。
 * @returns 0 起的下标；无法识别时返回 -1。
 */
function indexOfQuestionId(id) {
    const match = /^q(\d+)$/.exec(id);
    return match === null ? -1 : Number(match[1]) - 1;
}
/**
 * 把题目转成提问卡片的问题列表。
 * @param questions - 校验通过的题目。
 * @returns 一问一项、单选、选项标签带字母的请求。
 */
export function toQuestionItems(questions) {
    return questions.map((question, index) => ({
        id: questionId(index),
        question: `${index + 1}. ${question.stem}`,
        options: question.options.map((text, optionIndex) => ({ label: optionLabel(optionIndex, text) })),
        multiSelect: false,
    }));
}
/**
 * 把卡片回传的答案批次映射回选项下标。
 * @param questions - 当初发出去的题目。
 * @param answer - 宿主回传的答案批次。
 * @returns 按题号升序的作答；无法识别的题目被丢弃。
 */
export function interpretAnswers(questions, answer) {
    const answered = [];
    for (const item of answer.answers) {
        const index = indexOfQuestionId(item.id);
        const question = questions[index];
        if (question === undefined)
            continue;
        const selected = item.selected[0];
        const optionIndex = selected === undefined
            ? -1
            : question.options.findIndex((text, position) => optionLabel(position, text) === selected);
        answered.push({
            index: index + 1,
            optionIndex,
            letter: optionIndex < 0 ? '?' : optionLetter(optionIndex),
            custom: item.custom?.trim() ?? '',
        });
    }
    return answered.sort((left, right) => left.index - right.index);
}
/**
 * 把作答压成学生熟悉的 `1A 2B 3C`。
 * @param answered - 卡片作答。
 * @returns 单行文本；缺答的题用 `?` 占位，自由输入括注在后面。
 */
export function formatAnswers(answered) {
    return answered
        .map(item => (item.custom === '' ? `${item.index}${item.letter}` : `${item.index}${item.letter}（${item.custom}）`))
        .join(' ');
}
/**
 * 让学生点选作答。
 *
 * 卡片由宿主的 `dsh-client-ui-user-questions` 渲染在输入框座位（`conversation.composer`），
 * 一题一屏、选项可点，学生不需要打字。刻意不带 `wait.callId`：带 callId 的卡片
 * 在请求结束后不会被移除（客户端只清理匿名卡片），输入框会留下一张点不动的死卡片。
 * @param asker - 提问服务。
 * @param agent - 发起调用的 Agent；必须是当前运行的根 Agent。
 * @param quiz - 本次测验。
 * @param signal - 调用方取消信号。
 * @returns 作答列表；宿主没有答题者（headless 终端）、学生取消或调用被中断时返回 null。
 */
export async function askQuiz(asker, agent, quiz, signal) {
    try {
        const answer = await asker.ask({
            questions: toQuestionItems(quiz.questions),
            agent,
            ...(signal === undefined ? {} : { signal }),
        });
        const answered = interpretAnswers(quiz.questions, answer);
        return answered.length === 0 ? null : answered;
    }
    catch {
        // 点选卡片是加分项，不是测验的前提：终端/headless 里没有答题者，学生也可能
        // 直接关掉卡片。任何失败都退回「正文列出题目、学生用文字作答」的老路径，
        // 绝不让测验本身失败。
        return null;
    }
}
