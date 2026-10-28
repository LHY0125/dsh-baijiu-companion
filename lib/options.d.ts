/** 选项字母表；超过表长时退化为数字序号。 */
export declare const OPTION_LETTERS: readonly ["A", "B", "C", "D", "E", "F"];
/**
 * 取选项的字母标记。
 * @param index - 0 起的选项下标。
 * @returns 字母；越界时返回 1 起的数字序号。
 */
export declare function optionLetter(index: number): string;
/**
 * 生成选项的展示标签。
 *
 * 题目正文与提问卡片必须共用这一份生成函数：卡片回传的答案里只有标签，
 * 标签必须是选项下标的可逆编码，否则学生点了什么就映射不回来。
 * @param index - 0 起的选项下标。
 * @param text - 选项正文（已 trim）。
 * @returns 形如 `A. 高温堆积` 的标签。
 */
export declare function optionLabel(index: number, text: string): string;
