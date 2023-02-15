import Shortcut from '../@types/Shortcut'
import Icon from '../components/icons/ItalicTextIcon'
import getThoughtById from '../selectors/getThoughtById'
import formatSelection from '../util/formatSelection'
import head from '../util/head'
import isDocumentEditable from '../util/isDocumentEditable'

/** Toolbars shortcut instance of italic, which toggles italic font style of the cursor. */
const italic: Shortcut = {
  id: 'italic',
  label: 'Italic',
  description: 'Italicizes a thought.',
  svg: Icon,
  keyboard: { key: 'i', meta: true },
  canExecute: getState => isDocumentEditable() && !!getState().cursor,
  exec: (dispatch, getState) => {
    const state = getState()
    formatSelection(state, 'italic')
  },
  isActive: getState => {
    const state = getState()
    if (!state.cursor) return false
    const thought = getThoughtById(state, head(state.cursor))
    return thought.value.includes('<i>') || thought.value.includes('<em>')
  },
  isDropdownOpen: getState => !!getState().showColorPicker,
}

export default italic
