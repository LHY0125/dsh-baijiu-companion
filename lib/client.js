/**
 * 手写的客户端产物：把 submit_quiz / submit_grade 的工具结果直接渲染成可读卡片，
 * 而不是默认折叠的「已调用工具」行。
 *
 * 格式必须匹配 DSH 的模块加载协议（见 deepseek-harness 的 clientBundle 预设）：
 *   window.__ModuleLoader__.load({ id: <包名>, factory: (require) => { ...; return module.exports } })
 * 该文件不参与 tsc 构建，直接入库；修改后无需 pnpm run build。
 */
window.__ModuleLoader__.load({
  id: 'dsh-baijiu-companion',
  factory: require => {
    const module = { exports: {} }
    const React = require('react')
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives')
    const DisclosureRow = primitives.DisclosureRow

    /**
     * 取出工具结果里的纯文本。
     * @param {object} block - 工具调用块。
     * @returns {string} 拼接后的文本。
     */
    function contentText(block) {
      const items = block && block.content ? block.content : []
      return items
        .filter(item => item && item.type === 'text')
        .map(item => item.text)
        .join('\n')
    }

    /**
     * 出题/批改结果的卡片。
     * @param {object} props - 工具调用视图属性。
     * @returns {object} React 元素。
     */
    function ResultCard(props) {
      const block = props.block
      const isDone = props.phase === 'result'
      const isError = isDone && block && block.isError
      const text = isDone ? contentText(block) : ''
      const title = isError ? '白酒学伴 · 调用失败' : '白酒学伴 · 随堂内容'
      const [open, setOpen] = React.useState(true)

      const bodyStyle = {
        whiteSpace: 'pre-wrap',
        lineHeight: 1.7,
        fontSize: '13.5px',
        margin: 0,
      }

      return React.createElement(
        DisclosureRow,
        {
          title,
          open,
          expandable: text !== '',
          expandOnRowClick: true,
          keepContentWhenOpen: true,
          onToggle: () => setOpen(value => !value),
          collapsedContent: React.createElement(
            'span',
            { style: { opacity: 0.75 } },
            isDone ? '内容已生成，点击展开' : '正在准备…',
          ),
        },
        text ? React.createElement('pre', { style: bodyStyle }, text) : null,
      )
    }

    module.exports = {
      name: 'baijiu-companion-client',
      inject: ['slots'],
      /**
       * 注册两张卡片，分别对应出题与批改工具。
       * @param {object} ctx - 客户端上下文。
       */
      apply(ctx) {
        for (const key of ['submit_quiz', 'submit_grade']) {
          ctx.slots.inject('tool.call.toolview', () =>
            ctx.slots.register({ name: 'tool.call.toolview', key }, ResultCard),
          )
        }
      },
    }

    return module.exports
  },
})
