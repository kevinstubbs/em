import Shortcut from '../@types/Shortcut'
import { swapNoteActionCreator } from '../actions/swapNote'
import PencilIcon from '../components/icons/PencilIcon'
import asyncFocus from '../device/asyncFocus'
import hasMulticursor from '../selectors/hasMulticursor'
import isDocumentEditable from '../util/isDocumentEditable'

const swapNote: Shortcut = {
  id: 'swapNote',
  label: 'Convert to Note',
  description: 'Convert a thought to a note.',
  keyboard: { key: 'n', alt: true, shift: true },
  gesture: 'ulr',
  multicursor: true,
  svg: PencilIcon,
  canExecute: getState => {
    const state = getState()
    return isDocumentEditable() && (!!state.cursor || hasMulticursor(state))
  },
  exec: (dispatch, getState) => {
    asyncFocus()
    dispatch(swapNoteActionCreator())
  },
}

export default swapNote
