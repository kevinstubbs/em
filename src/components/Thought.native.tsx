import _ from 'lodash'
import { View } from 'moti'
import React, { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import { connect, useSelector } from 'react-redux'
import Context from '../@types/Context'
import Index from '../@types/IndexType'
import LazyEnv from '../@types/LazyEnv'
import Path from '../@types/Path'
import SimplePath from '../@types/SimplePath'
import State from '../@types/State'
import ThoughtId from '../@types/ThoughtId'
import alert from '../action-creators/alert'
import dragHold from '../action-creators/dragHold'
import dragInProgress from '../action-creators/dragInProgress'
import setCursor from '../action-creators/setCursor'
import { AlertText, DROP_TARGET, MAX_DISTANCE_FROM_CURSOR, TIMEOUT_LONG_PRESS_THOUGHT } from '../constants'
import globals from '../globals'
import useLongPress from '../hooks/useLongPress'
import useSubthoughtHovering from '../hooks/useSubthoughtHovering'
import attribute from '../selectors/attribute'
import childIdsToThoughts from '../selectors/childIdsToThoughts'
import { getChildren, getChildrenRanked, hasChildren } from '../selectors/getChildren'
import getThoughtById from '../selectors/getThoughtById'
import rootedParentOf from '../selectors/rootedParentOf'
import { store } from '../store'
import { commonStyles } from '../style/commonStyles'
import equalPath from '../util/equalPath'
import hashPath from '../util/hashPath'
import head from '../util/head'
import isDescendantPath from '../util/isDescendantPath'
import parentOf from '../util/parentOf'
import parseJsonSafe from '../util/parseJsonSafe'
import publishMode from '../util/publishMode'
import Bullet from './Bullet'
import Byline from './Byline'
import { ConnectedDraggableThoughtContainerProps } from './DragAndDropThought'
import Note from './Note'
import StaticThought from './StaticThought'
import Subthoughts from './Subthoughts.native'
import useHideBullet from './Thought.useHideBullet'
import useStyle from './Thought.useStyle'

/**********************************************************************
 * Redux
 **********************************************************************/

export interface ThoughtContainerProps {
  allowSingleContext?: boolean
  childrenForced?: ThoughtId[]
  contextBinding?: Path
  path: Path
  cursor?: Path | null
  depth?: number
  env?: Index<ThoughtId>
  expandedContextThought?: Path
  hideBullet?: boolean
  isDeepHovering?: boolean
  isPublishChild?: boolean
  isCursorGrandparent?: boolean
  isCursorParent?: boolean
  isDragging?: boolean
  isEditing?: boolean
  isEditingPath?: boolean
  isExpanded?: boolean
  isHovering?: boolean
  isParentHovering?: boolean
  isVisible?: boolean
  prevChildId?: ThoughtId
  publish?: boolean
  rank: number
  showContexts?: boolean
  style?: React.CSSProperties
  styleContainer?: React.CSSProperties
  simplePath: SimplePath
  view?: string | null
}

interface ThoughtProps {
  cursorOffset?: number | null
  env?: Index<Context>
  hideBullet?: boolean
  isDragging?: boolean
  isPublishChild?: boolean
  isEditing?: boolean
  isLeaf?: boolean
  isVisible?: boolean
  path: Path
  publish?: boolean
  rank: number
  showContextBreadcrumbs?: boolean
  showContexts?: boolean
  style?: React.CSSProperties
  styleContainer?: React.CSSProperties
  simplePath: SimplePath
  view?: string | null
}

export type ConnectedThoughtProps = ThoughtProps

export type ConnectedThoughtContainerProps = ThoughtContainerProps & ReturnType<typeof mapStateToProps>

// placeholder since mobile Thought component does not have mapDispatchToProps
export type ConnectedThoughtDispatchProps = Record<string, never>

// eslint-disable-next-line jsdoc/require-jsdoc
const mapStateToProps = (state: State, props: ThoughtContainerProps) => {
  const { cursor, cursorOffset, expanded, expandedContextThought, search, expandHoverTopPath } = state

  const { path, simplePath, depth } = props

  // check if the cursor path includes the current thought
  const isEditingPath = isDescendantPath(cursor, path)

  // check if the cursor is editing a thought directly
  const isEditing = equalPath(cursor, path)

  const distance = cursor ? Math.max(0, Math.min(MAX_DISTANCE_FROM_CURSOR, cursor.length - depth!)) : 0

  const isExpandedHoverTopPath = expandHoverTopPath && equalPath(path, expandHoverTopPath)

  // Note: If the thought is the active expand hover top path then it should be treated as a cursor parent. It is because the current implementation allows tree to unfold visually starting from cursor parent.
  const isCursorParent =
    isExpandedHoverTopPath ||
    (!!cursor &&
      (distance === 2
        ? // grandparent
          equalPath(rootedParentOf(state, parentOf(cursor)), path) && getChildren(state, head(cursor)).length === 0
        : // parent
          equalPath(parentOf(cursor), path)))

  const contextBinding = parseJsonSafe(attribute(state, head(simplePath), '=bindContext') ?? '') as
    | SimplePath
    | undefined

  // Note: An active expand hover top thought cannot be a cusor's grandparent as it is already treated as cursor's parent.
  const isCursorGrandparent =
    !isExpandedHoverTopPath && !!cursor && equalPath(rootedParentOf(state, parentOf(cursor)), path)

  const isExpanded = !!expanded[hashPath(path)]
  const isLeaf = !hasChildren(state, head(simplePath))

  return {
    contextBinding,
    cursorOffset,
    distance,
    expandedContextThought,
    isCursorGrandparent,
    isCursorParent,
    isEditing,
    isEditingPath,
    isExpanded,
    isLeaf,
    isPublishChild: !search && publishMode() && simplePath.length === 2,
    publish: !search && publishMode(),
    simplePath,
    view: attribute(state, head(simplePath), '=view'),
  }
}

const { directionRow, alignItemsCenter, marginBottom } = commonStyles

/**********************************************************************
 * Components
 **********************************************************************/

/** A thought container with bullet, thought annotation, thought, and subthoughts.
 *
  @param allowSingleContext  Pass through to Subthoughts since the SearchSubthoughts component does not have direct access to the Subthoughts of the Subthoughts of the search. Default: false.
 */
const ThoughtContainer = ({
  allowSingleContext,
  childrenForced,
  contextBinding,
  cursor,
  cursorOffset,
  depth = 0,
  dragPreview,
  dragSource,
  dropTarget,
  env,
  expandedContextThought,
  hideBullet: hideBulletProp,
  isBeingHoveredOver,
  isCursorGrandparent,
  isCursorParent,
  isDeepHovering,
  isDragging,
  isEditing,
  isEditingPath,
  isExpanded,
  isHovering,
  isLeaf,
  isParentHovering,
  isPublishChild,
  isVisible,
  path,
  prevChildId,
  publish,
  rank,
  showContexts,
  simplePath,
  style: styleProp,
  styleContainer: styleContainerProp,
  view,
}: ConnectedDraggableThoughtContainerProps) => {
  const state = store.getState()
  const thought = getThoughtById(state, head(simplePath))
  const thoughtId = head(simplePath)

  const children = useSelector(
    (state: State) =>
      childrenForced ? childIdsToThoughts(state, childrenForced) : getChildrenRanked(state, head(simplePath)),
    _.isEqual,
  )

  useEffect(() => {
    if (isBeingHoveredOver) {
      store.dispatch(
        dragInProgress({
          value: true,
          draggingThought: state.draggingThought,
          hoveringPath: path,
          hoverId: DROP_TARGET.ThoughtDrop,
        }),
      )
    }
  }, [isBeingHoveredOver])

  /** Highlight bullet and show alert on long press on Thought. */
  const onLongPressStart = () => {
    if (!store.getState().dragHold) {
      store.dispatch([dragHold({ value: true, simplePath }), alert(AlertText.DragAndDrop, { showCloseLink: false })])
    }
  }

  /** Cancel highlighting of bullet and dismiss alert when long press finished. */
  const onLongPressEnd = () => {
    if (store.getState().dragHold) {
      store.dispatch([dragHold({ value: false }), alert(null)])
    }
  }

  // temporarily disable
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const longPressHandlerProps = useLongPress(onLongPressStart, onLongPressEnd, TIMEOUT_LONG_PRESS_THOUGHT)

  const envParsed = JSON.parse(env || '{}') as LazyEnv
  const hideBullet = useHideBullet({ children, env: envParsed, hideBulletProp, isEditing, simplePath, thoughtId })
  const isSubthoughtHovering = useSubthoughtHovering(simplePath, isHovering, isDeepHovering)
  const style = useStyle({ children, env: envParsed, styleProp, thoughtId })

  if (!thought) return null

  // prevent fading out cursor parent
  // there is a special case here for the cursor grandparent when the cursor is a leaf
  // See: <Subthoughts> render

  const showContextBreadcrumbs =
    showContexts && (!globals.ellipsizeContextThoughts || equalPath(path, expandedContextThought as Path | null))

  // const optionsId = findDescendant(state, parentId, '=options')
  // const childrenOptions = getAllChildrenAsThoughts(state, optionsId)
  // const options =
  //   !isAttribute(value) && childrenOptions.length > 0 ? childrenOptions.map(child => child.value.toLowerCase()) : null

  // const cursorOnAlphabeticalSort = cursor && getSortPreference(state, thoughtId).type === 'Alphabetical'

  // const draggingThoughtValue = state.draggingThought
  //   ? getThoughtById(state, headId(state.draggingThought))?.value
  //   : null

  /** Checks if any descendents of the direct siblings is being hovered. */
  // const isAnySiblingDescendantHovering = () =>
  //   !isHovering &&
  //   state.hoveringPath &&
  //   isDescendantPath(state.hoveringPath, parentOf(path)) &&
  //   (state.hoveringPath.length !== path.length || state.hoverId === DROP_TARGET.SubthoughtsDrop)

  // const shouldDisplayHover = cursorOnAlphabeticalSort
  //   ? // if alphabetical sort is enabled check if drag is in progress and parent element is hovering
  //     state.dragInProgress &&
  //     isParentHovering &&
  //     draggingThoughtValue &&
  //     !isAnySiblingDescendantHovering() &&
  //     // check if it's alphabetically previous to current thought
  //     compareReasonable(draggingThoughtValue, value) <= 0 &&
  //     // check if it's alphabetically next to previous thought if it exists
  //     (!prevChild || compareReasonable(draggingThoughtValue, prevChild.value) === 1)
  //   : // if alphabetical sort is disabled just check if current thought is hovering
  //     globals.simulateDropHover || isHovering

  const isProseView = hideBullet

  return (
    <View style={marginBottom}>
      <View style={[directionRow, alignItemsCenter]}>
        {!(publish && simplePath.length === 0) && (!isLeaf || !isPublishChild) && !hideBullet && (
          <Bullet
            isEditing={isEditing}
            thoughtId={thoughtId}
            leaf={isLeaf}
            onClick={() => {
              if (!isEditing || children.length === 0) {
                store.dispatch(setCursor({ path: simplePath }))
              }
            }}
            path={path}
            simplePath={simplePath}
            publish={publish}
          />
        )}

        {isProseView && <View style={styles(isEditing).proseView} />}

        {/* // Todo: still need to decide the best approach to implement the annotations.
        <ThoughtAnnotation
          env={env}
          path={path}
          minContexts={allowSingleContext ? 0 : 2}
          showContextBreadcrumbs={showContextBreadcrumbs}
          showContexts={showContexts}
          style={styleNew}
          simplePath={showContexts ? parentOf(simplePath) : simplePath}
        /> */}

        <StaticThought
          path={path}
          cursorOffset={cursorOffset}
          isVisible={isVisible}
          isPublishChild={isPublishChild}
          isEditing={isEditing}
          rank={rank}
          showContextBreadcrumbs={showContextBreadcrumbs}
          style={style}
          simplePath={simplePath}
          view={view}
        />
      </View>
      <Note path={simplePath} />

      {publish && simplePath.length === 0 && <Byline id={head(parentOf(simplePath))} />}

      <Subthoughts
        allowSingleContext={allowSingleContext}
        childrenForced={childrenForced}
        env={env}
        path={path}
        depth={depth}
        isParentHovering={isSubthoughtHovering}
        showContexts={allowSingleContext}
        simplePath={simplePath}
        view={view}
      />
    </View>
  )
}

/** Styles. */
const styles = (isEditing?: boolean) =>
  StyleSheet.create({
    proseView: {
      backgroundColor: 'white',
      borderRadius: 10,
      height: 20,
      marginRight: 15,
      opacity: isEditing ? 0.2 : 0,
      width: 20,
    },
  })

ThoughtContainer.displayName = 'ThoughtContainer'

// export connected, drag and drop higher order thought component
const ThoughtComponent = connect(mapStateToProps)(ThoughtContainer)

export default ThoughtComponent
