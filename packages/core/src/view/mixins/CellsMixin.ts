/*
Copyright 2021-present The maxGraph project Contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import Cell from '../cell/Cell';
import { mixInto } from '../../util/Utils';
import {
  contains,
  getBoundingBox,
  getRotatedPoint,
  intersects,
  ptSegDistSq,
  toRadians,
} from '../../util/mathUtils';
import {
  getSizeForString,
  setCellStyleFlags,
  setCellStyles,
} from '../../util/styleUtils';
import {
  ALIGN,
  DEFAULT_FONTSIZE,
  DEFAULT_IMAGESIZE,
  DIRECTION,
  SHAPE,
} from '../../util/Constants';
import Geometry from '../geometry/Geometry';
import EventObject from '../event/EventObject';
import InternalEvent from '../event/InternalEvent';
import Rectangle from '../geometry/Rectangle';
import Dictionary from '../../util/Dictionary';
import Point from '../geometry/Point';
import { htmlEntities } from '../../util/StringUtils';
import CellState from '../cell/CellState';
import { Graph } from '../Graph';
import { cloneCells, getTopmostCells } from '../../util/cellArrayUtils';

import type { CellStateStyle, CellStyle, NumericCellStateStyleKeys } from '../../types';

declare module '../Graph' {
  interface Graph {
    /**
     * Specifies the return value for {@link isCellsResizable}.
     * @default true
     */
    cellsResizable: boolean;

    /**
     * Specifies the return value for {@link isCellsBendable}.
     * @default true
     */
    cellsBendable: boolean;

    /**
     * Specifies the return value for {@link isCellsSelectable}.
     * @default true
     */
    cellsSelectable: boolean;

    /**
     * Specifies the return value for {@link isCellsDisconnectable}.
     * @default true
     */
    cellsDisconnectable: boolean;

    /**
     * Specifies if the graph should automatically update the cell size after an
     * edit. This is used in {@link isAutoSizeCell}.
     * @default false
     */
    autoSizeCells: boolean;

    /**
     * Specifies if autoSize style should be applied when cells are added.
     * @default false
     */
    autoSizeCellsOnAdd: boolean;

    /**
     * Specifies the return value for {@link isCellLocked}.
     * @default false
     */
    cellsLocked: boolean;

    /**
     * Specifies the return value for {@link isCellCloneable}.
     * @default true
     */
    cellsCloneable: boolean;

    /**
     * Specifies the return value for {@link isCellDeletable}.
     * @default true
     */
    cellsDeletable: boolean;

    /**
     * Specifies the return value for {@link isCellMovable}.
     * @default true
     */
    cellsMovable: boolean;

    /**
     * Specifies if a parent should contain the child bounds after a resize of
     * the child. This has precedence over {@link constrainChildren}.
     * @default true
     */
    extendParents: boolean;

    /**
     * Specifies if parents should be extended according to the {@link extendParents}
     * switch if cells are added.
     * @default true
     */
    extendParentsOnAdd: boolean;

    /**
     * Specifies if parents should be extended according to the {@link extendParents}
     * switch if cells are added.
     * @default false (for backwards compatibility)
     */
    extendParentsOnMove: boolean;

    /**
     * Returns the bounding box for the given array of {@link Cell}. The bounding box for
     * each cell and its descendants is computed using {@link view.getBoundingBox}.
     *
     * @param cells Array of {@link Cell} whose bounding box should be returned.
     */
    getBoundingBox: (cells: Cell[]) => Rectangle | null;

    /**
     * Removes all cached information for the given cell and its descendants.
     * This is called when a cell was removed from the model.
     *
     * @param cell {@link Cell} that was removed from the model.
     */
    removeStateForCell: (cell: Cell) => void;

    /**
     * Returns the style for the given cell from the cell state, if one exists,
     * or using {@link getCellStyle}.
     *
     * @param cell {@link Cell} whose style should be returned as an array.
     * @param ignoreState Optional boolean that specifies if the cell state should be ignored.
     */
    getCurrentCellStyle: (cell: Cell, ignoreState?: boolean) => CellStateStyle;

    /**
     * Returns the computed style of the Cell using the edge or vertex default style regarding of the type of the cell.
     * The actual computation is done by {@link Stylesheet.getCellStyle}.
     *
     * **Note**: You should try and get the cell state for the given cell and use the cached style in the state before using this method.
     *
     * @param cell {@link Cell} whose style should be returned as an array.
     */
    getCellStyle: (cell: Cell) => CellStateStyle;

    /**
     * Tries to resolve the value for the image style in the image bundles and
     * turns short data URIs as defined in {@link ImageBundle} to data URIs as
     * defined in RFC 2397 of the IETF.
     */
    postProcessCellStyle: (style: CellStateStyle) => CellStateStyle;

    /**
     * Sets the style of the specified cells. If no cells are given, then the selection cells are changed.
     *
     * **IMPORTANT**: Do not pass {@link Cell.getStyle} as value of the `style` parameter. Always get a clone of the style of the cell with {@link Cell.getClonedStyle}, then update it and pass the updated style to this method.
     * For more details, see {@link GraphDataModel.setStyle}.
     *
     * @param style String representing the new style of the cells.
     * @param cells Optional array of {@link Cell} to set the style for. Default is the selection cells.
     */
    setCellStyle: (style: CellStyle, cells?: Cell[]) => void;

    /**
     * Toggles the boolean value for the given key in the style of the given cell and returns the new value as boolean.
     *
     * If no cell is specified then the selection cell is used.
     *
     * @param key String representing the key for the boolean value to be toggled.
     * @param defaultValue Optional boolean default value if no value is defined. Default is `false`.
     * @param cell Optional {@link Cell} whose style should be modified. Default is the selection cell.
     */
    toggleCellStyle: (
      key: keyof CellStateStyle,
      defaultValue: boolean,
      cell: Cell
    ) => boolean | null;

    /**
     * Toggles the boolean value for the given key in the style of the given cells and returns the new value as boolean.
     *
     * If no cells are specified, then the selection cells are used.
     *
     * For example, this can be used to toggle {@link CellStateStyle.rounded} or any other style with a boolean value.
     *
     * @param key String representing the key for the boolean value to be toggled.
     * @param defaultValue Optional boolean default value if no value is defined. Default is `false`.
     * @param cells Optional array of {@link Cell} whose styles should be modified. Default is the selection cells.
     */
    toggleCellStyles: (
      key: keyof CellStateStyle,
      defaultValue?: boolean,
      cells?: Cell[]
    ) => boolean | null;

    /**
     * Sets the key to value in the styles of the given cells. This will modify the existing cell styles in-place and override any existing assignment for the given key.
     *
     * If no cells are specified, then the selection cells are changed.
     *
     * If no value is specified, then the respective key is removed from the styles.
     *
     * @param key String representing the key to be assigned.
     * @param value String representing the new value for the key.
     * @param cells Optional array of {@link Cell} to change the style for. Default is the selection cells.
     */
    setCellStyles: (
      key: keyof CellStateStyle,
      value: CellStateStyle[keyof CellStateStyle],
      cells?: Cell[]
    ) => void;

    /**
     * Toggles the given bit for the given key in the styles of the specified cells.
     *
     * @param key String representing the key to toggle the flag in.
     * @param flag Integer that represents the bit to be toggled.
     * @param cells Optional array of {@link Cell} to change the style for. Default is the selection cells.
     */
    toggleCellStyleFlags: (
      key: NumericCellStateStyleKeys,
      flag: number,
      cells?: Cell[] | null
    ) => void;

    /**
     * Sets or toggles the given bit for the given key in the styles of the specified cells.
     *
     * @param key String representing the key to toggle the flag in.
     * @param flag Integer that represents the bit to be toggled.
     * @param value Boolean value to be used or null if the value should be toggled.
     * @param cells Optional array of {@link Cell} to change the style for. Default is the selection cells.
     */
    setCellStyleFlags: (
      key: NumericCellStateStyleKeys,
      flag: number,
      value?: boolean | null,
      cells?: Cell[] | null
    ) => void;

    /**
     * Aligns the given cells vertically or horizontally according to the given alignment using the optional parameter as the coordinate.
     *
     * @param align Specifies the alignment. Possible values are all entries of the {@link ALIGN} enum.
     * @param cells Array of {@link Cell} to be aligned.
     * @param param Optional coordinate for the alignment.
     */
    alignCells: (align: string, cells?: Cell[], param?: number | null) => void;

    /**
     * Returns the clone for the given cell. Uses {@link cloneCells}.
     *
     * @param cell {@link Cell} to be cloned.
     * @param allowInvalidEdges Optional boolean that specifies if invalid edges should be cloned. Default is `true`.
     * @param mapping Optional mapping for existing clones.
     * @param keepPosition Optional boolean indicating if the position of the cells should be updated to reflect the lost parent cell. Default is `false`.
     */
    cloneCell: (
      cell: Cell,
      allowInvalidEdges?: boolean,
      mapping?: any,
      keepPosition?: boolean
    ) => Cell;

    /**
     * Returns the clones for the given cells. The clones are created recursively using {@link cloneCells}.
     *
     * If the terminal of an edge is not in the given array, then the respective end is assigned a terminal point and the terminal is removed.
     *
     * @param cells Array of {@link Cell} to be cloned.
     * @param allowInvalidEdges Optional boolean that specifies if invalid edges should be cloned. Default is `true`.
     * @param mapping Optional mapping for existing clones.
     * @param keepPosition Optional boolean indicating if the position of the cells should be updated to reflect the lost parent cell. Default is `false`.
     */
    cloneCells: (
      cells: Cell[],
      allowInvalidEdges?: boolean,
      mapping?: any,
      keepPosition?: boolean
    ) => Cell[];

    /**
     * Adds the cell to the parent and connects it to the given source and target terminals.
     *
     * This is a shortcut method.
     *
     * @param cell {@link mxCell} to be inserted into the given parent.
     * @param parent {@link mxCell} that represents the new parent. If no parent is given then the default parent is used.
     * @param index Optional index to insert the cells at. Default is 'to append'.
     * @param source Optional {@link Cell} that represents the source terminal.
     * @param target Optional {@link Cell} that represents the target terminal.
     * @returns the cell that was added.
     */
    addCell: (
      cell: Cell,
      parent: Cell | null,
      index?: number | null,
      source?: Cell | null,
      target?: Cell | null
    ) => Cell;

    /**
     * Adds the cells to the parent at the given index, connecting each cell to
     * the optional source and target terminal. The change is carried out using
     * {@link cellsAdded}. This method fires {@link Event#ADD_CELLS} while the
     * transaction is in progress. Returns the cells that were added.
     *
     * @param cells Array of {@link Cell}s to be inserted.
     * @param parent {@link Cell} that represents the new parent. If no parent is given then the default parent is used.
     * @param index Optional index to insert the cells at. Default is to append.
     * @param source Optional source {@link Cell} for all inserted cells.
     * @param target Optional target {@link Cell} for all inserted cells.
     * @param absolute Optional boolean indicating of cells should be kept at their absolute position. Default is `false`.
     */
    addCells: (
      cells: Cell[],
      parent: Cell | null,
      index: number | null,
      source: Cell | null,
      target: Cell | null,
      absolute?: boolean
    ) => Cell[];

    /**
     * Adds the specified cells to the given parent. This method fires
     * {@link Event#CELLS_ADDED} while the transaction is in progress.
     */
    cellsAdded: (
      cells: Cell[],
      parent: Cell,
      index: number,
      source: Cell | null,
      target: Cell | null,
      absolute: boolean,
      constrain?: boolean,
      extend?: boolean
    ) => void;

    /**
     * Resizes the specified cell to just fit around its label and/or children.
     *
     * @param cell {@link mxCell} to be resized.
     * @param recurse Optional boolean which specifies if all descendants should be auto-sized. Default is `true`.
     */
    autoSizeCell: (cell: Cell, recurse?: boolean) => void;

    /**
     * Removes the given cells from the graph including all connected edges if
     * includeEdges is true. The change is carried out using {@link cellsRemoved}.
     * This method fires {@link InternalEvent.REMOVE_CELLS} while the transaction is in
     * progress. The removed cells are returned as an array.
     *
     * @param cells Array of {@link Cell} to remove. If null is specified then the selection cells which are deletable are used.
     * @param includeEdges Optional boolean which specifies if all connected edges should be removed as well. Default is `true`.
     */
    removeCells: (cells?: Cell[] | null, includeEdges?: boolean | null) => Cell[];

    /**
     * Removes the given cells from the model. This method fires
     * {@link InternalEvent.CELLS_REMOVED} while the transaction is in progress.
     *
     * @param cells Array of {@link Cell} to remove.
     */
    cellsRemoved: (cells: Cell[]) => void;

    /**
     * Sets the visible state of the specified cells and all connected edges
     * if includeEdges is true. The change is carried out using {@link cellsToggled}.
     * This method fires {@link InternalEvent.TOGGLE_CELLS} while the transaction is in
     * progress. Returns the cells whose visible state was changed.
     *
     * @param show Boolean that specifies the visible state to be assigned.
     * @param cells Array of {@link Cell} whose visible state should be changed. If `null` is specified then the selection cells are used.
     * @param includeEdges Optional boolean indicating if the visible state of all connected edges should be changed as well. Default is `true`.
     */
    toggleCells: (show: boolean, cells: Cell[], includeEdges: boolean) => Cell[];

    /**
     * Sets the visible state of the specified cells.
     *
     * @param cells Array of {@link Cell} whose visible state should be changed.
     * @param show Boolean that specifies the visible state to be assigned.
     */
    cellsToggled: (cells: Cell[], show: boolean) => void;

    /**
     * Updates the size of the given cell in the model using {@link cellSizeUpdated}.
     * This method fires {@link InternalEvent.UPDATE_CELL_SIZE} while the transaction is in
     * progress. Returns the cell whose size was updated.
     *
     * @param cell {@link Cell} whose size should be updated.
     * @param ignoreChildren if `true`, ignore the children of the cell when computing the size of the cell. Default is `false`.
     */
    updateCellSize: (cell: Cell, ignoreChildren?: boolean) => Cell;

    /**
     * Updates the size of the given cell in the model using {@link getPreferredSizeForCell} to get the new size.
     *
     * @param cell {@link Cell} for which the size should be changed.
     * @param ignoreChildren if `true`, ignore the children of the cell when computing the size of the cell. Default is `false`.
     */
    cellSizeUpdated: (cell: Cell, ignoreChildren: boolean) => void;

    /**
     * Returns the preferred width and height of the given {@link Cell} as an
     * {@link Rectangle}. To implement a minimum width, add a new style e.g.
     * minWidth in the vertex and override this method as follows.
     *
     * ```javascript
     * var graphGetPreferredSizeForCell = graph.getPreferredSizeForCell;
     * graph.getPreferredSizeForCell(cell)
     * {
     *   var result = graphGetPreferredSizeForCell.apply(this, arguments);
     *   var style = this.getCellStyle(cell);
     *
     *   if (style.minWidth > 0)
     *   {
     *     result.width = Math.max(style.minWidth, result.width);
     *   }
     *
     *   return result;
     * };
     * ```
     *
     * @param cell {@link mxCell} for which the preferred size should be returned.
     * @param textWidth Optional maximum text width for word wrapping.
     */
    getPreferredSizeForCell: (cell: Cell, textWidth?: number | null) => Rectangle | null;

    /**
     * Sets the bounds of the given cell using {@link resizeCells}. Returns the
     * cell which was passed to the function.
     *
     * @param cell {@link Cell} whose bounds should be changed.
     * @param bounds {@link Rectangle} that represents the new bounds.
     * @param recurse Optional boolean that specifies if the children should be resized. Default is `false`.
     */
    resizeCell: (cell: Cell, bounds: Rectangle, recurse?: boolean) => Cell;

    /**
     * Sets the bounds of the given cells and fires a {@link InternalEvent.RESIZE_CELLS}
     * event while the transaction is in progress. Returns the cells which
     * have been passed to the function.
     *
     * @param cells Array of {@link Cell} whose bounds should be changed.
     * @param bounds Array of {@link Rectangle}s that represent the new bounds.
     * @param recurse Optional boolean that specifies if the children should be resized. Default is {@link isRecursiveResize}.
     */
    resizeCells: (cells: Cell[], bounds: Rectangle[], recurse: boolean) => Cell[];

    /**
     * Sets the bounds of the given cells and fires a {@link InternalEvent.CELLS_RESIZED}
     * event. If {@link extendParents} is true, then the parent is extended if a
     * child size is changed so that it overlaps with the parent.
     *
     * The following example shows how to control group resizes to make sure
     * that all child cells stay within the group.
     *
     * ```javascript
     * graph.addListener(mxEvent.CELLS_RESIZED, function(sender, evt)
     * {
     *   var cells = evt.getProperty('cells');
     *
     *   if (cells != null)
     *   {
     *     for (var i = 0; i < cells.length; i++)
     *     {
     *       if (graph.getDataModel().getChildCount(cells[i]) > 0)
     *       {
     *         var geo = cells[i].getGeometry();
     *
     *         if (geo != null)
     *         {
     *           var children = graph.getChildCells(cells[i], true, true);
     *           var bounds = graph.getBoundingBoxFromGeometry(children, true);
     *
     *           geo = geo.clone();
     *           geo.width = Math.max(geo.width, bounds.width);
     *           geo.height = Math.max(geo.height, bounds.height);
     *
     *           graph.getDataModel().setGeometry(cells[i], geo);
     *         }
     *       }
     *     }
     *   }
     * });
     * ```
     *
     * @param cells Array of {@link Cell} whose bounds should be changed.
     * @param bounds Array of {@link Rectangle}s that represent the new bounds.
     * @param recurse Optional boolean that specifies if the children should be resized. Default is `false`.
     */
    cellsResized: (cells: Cell[], bounds: Rectangle[], recurse: boolean) => void;

    /**
     * Resizes the parents recursively so that they contain the complete area of the resized child cell.
     *
     * @param cell {@link Cell} whose bounds should be changed.
     * @param bounds {@link Rectangle}s that represent the new bounds.
     * @param ignoreRelative Boolean that indicates if relative cells should be ignored. Default is `false`.
     * @param recurse Optional boolean that specifies if the children should be resized. Default is `false`.
     */
    cellResized: (
      cell: Cell,
      bounds: Rectangle,
      ignoreRelative: boolean,
      recurse: boolean
    ) => Geometry | null;

    /**
     * Resizes the child cells of the given cell for the given new geometry with respect to the current geometry of the cell.
     *
     * @param cell {@link Cell} that has been resized.
     * @param newGeo {@link Geometry} that represents the new bounds.
     */
    resizeChildCells: (cell: Cell, newGeo: Geometry) => void;

    /**
     * Constrains the children of the given cell using {@link constrainChild}.
     *
     * @param cell {@link Cell} that has been resized.
     */
    constrainChildCells: (cell: Cell) => void;

    /**
     * Scales the points, position and size of the given cell according to the given vertical and horizontal scaling factors.
     *
     * @param cell {@link Cell} whose geometry should be scaled.
     * @param dx Horizontal scaling factor.
     * @param dy Vertical scaling factor.
     * @param recurse Boolean indicating if the child cells should be scaled. Default is `false`.
     */
    scaleCell: (cell: Cell, dx: number, dy: number, recurse: boolean) => void;

    /**
     * Resizes the parents recursively so that they contain the complete area of the resized child cell.
     *
     * @param cell {@link Cell} that has been resized.
     */
    extendParent: (cell: Cell) => void;

    /**
     * Clones and inserts the given cells into the graph using the move method and returns the inserted cells. This shortcut
     * is used if cells are inserted via data transfer.
     *
     * @param cells Array of {@link Cell} to be imported.
     * @param dx Integer that specifies the x-coordinate of the vector. Default is `0`.
     * @param dy Integer that specifies the y-coordinate of the vector. Default is `0`.
     * @param target {@link Cell} that represents the new parent of the cells.
     * @param evt {@link MouseEvent} that triggered the invocation.
     * @param mapping Optional mapping for existing clones.
     * @returns the cells that were imported.
     */
    importCells: (
      cells: Cell[],
      dx?: number,
      dy?: number,
      target?: Cell | null,
      evt?: MouseEvent | null,
      mapping?: any
    ) => Cell[];

    /**
     * Moves or clones the specified cells and moves the cells or clones by the given amount, adding them to the optional
     * target cell. The `evt` is the mouse event as the mouse was released. The change is carried out using {@link cellsMoved}.
     * This method fires {@link Event#MOVE_CELLS} while the transaction is in progress.
     *
     * Use the following code to move all cells in the graph.
     *
     * ```javascript
     * graph.moveCells(graph.getChildCells(null, true, true), 10, 10);
     * ```
     *
     * @param cells Array of {@link Cell} to be moved, cloned or added to the target.
     * @param dx Integer that specifies the x-coordinate of the vector. Default is `0`.
     * @param dy Integer that specifies the y-coordinate of the vector. Default is `0`.
     * @param clone Boolean indicating if the cells should be cloned. Default is `false`.
     * @param target {@link Cell} that represents the new parent of the cells.
     * @param evt {@link MouseEvent} that triggered the invocation.
     * @param mapping Optional mapping for existing clones.
     * @returns the cells that were moved.
     */
    moveCells: (
      cells: Cell[],
      dx?: number,
      dy?: number,
      clone?: boolean,
      target?: Cell | null,
      evt?: MouseEvent | null,
      mapping?: any
    ) => Cell[];

    /**
     * Moves the specified cells by the given vector, disconnecting the cells using disconnectGraph is disconnect is true.
     *
     * This method fires {@link InternalEvent.CELLS_MOVED} while the transaction is in progress.
     */
    cellsMoved: (
      cells: Cell[],
      dx: number,
      dy: number,
      disconnect: boolean,
      constrain: boolean,
      extend?: boolean | null
    ) => void;

    /**
     * Translates the geometry of the given cell and stores the new, translated geometry in the model as an atomic change.
     */
    translateCell: (cell: Cell, dx: number, dy: number) => void;

    /**
     * Returns the {@link Rectangle} inside which a cell is to be kept.
     *
     * @param cell {@link Cell} for which the area should be returned.
     */
    getCellContainmentArea: (cell: Cell) => Rectangle | null;

    /**
     * Keeps the given cell inside the bounds returned by {@link getCellContainmentArea} for its parent,
     * according to the rules defined by {@link getOverlap} and {@link isConstrainChild}.
     *
     * This modifies the cell's geometry in-place and does not clone it.
     *
     * @param cell {@link Cell} which should be constrained.
     * @param sizeFirst Specifies if the size should be changed first. Default is `true`.
     */
    constrainChild: (cell: Cell, sizeFirst?: boolean) => void;

    /**
     * Returns the visible child vertices or edges in the given parent.
     *
     * If vertices and edges is `false`, then all children are returned.
     *
     * @param parent {@link mxCell} whose children should be returned.
     * @param vertices Optional boolean that specifies if child vertices should be returned. Default is `false`.
     * @param edges Optional boolean that specifies if child edges should be returned. Default is `false`.
     */
    getChildCells: (parent?: Cell | null, vertices?: boolean, edges?: boolean) => Cell[];

    /**
     * Returns the bottom-most cell that intersects the given point (x, y) in the cell hierarchy starting at the given parent.
     *
     * This will also return swimlanes if the given location intersects the content area of the swimlane.
     * If this is not desired, then the {@link hitsSwimlaneContent} may be used if the returned cell is a swimlane
     * to determine if the location is inside the content area or on the actual title of the swimlane.
     *
     * @param x X-coordinate of the location to be checked.
     * @param y Y-coordinate of the location to be checked.
     * @param parent {@link mxCell} that should be used as the root of the recursion. Default is current root of the view or the root of the model.
     * @param vertices Optional boolean indicating if vertices should be returned. Default is `true`.
     * @param edges Optional boolean indicating if edges should be returned. Default is `true`.
     * @param ignoreFn Optional function that returns true if cell should be ignored. The function is passed the cell state and the x and y parameter. Default is `null`.
     */
    getCellAt: (
      x: number,
      y: number,
      parent?: Cell | null,
      vertices?: boolean | null,
      edges?: boolean | null,
      ignoreFn?: Function | null
    ) => Cell | null;

    /**
     * Returns the child vertices and edges of the given parent that are contained in the given rectangle.
     *
     * The result is added to the optional result array, which is returned.
     * If no result array is specified then a new array is created and returned.
     *
     * @param x X-coordinate of the rectangle.
     * @param y Y-coordinate of the rectangle.
     * @param width Width of the rectangle.
     * @param height Height of the rectangle.
     * @param parent {@link mxCell} that should be used as the root of the recursion. Default is current root of the view or the root of the model.
     * @param result Optional array to store the result in. Default is an empty Array.
     * @param intersection Default is `null`.
     * @param ignoreFn Default is `null`.
     * @param includeDescendants Default is `false`.
     */
    getCells: (
      x: number,
      y: number,
      width: number,
      height: number,
      parent?: Cell | null,
      result?: Cell[],
      intersection?: Rectangle | null,
      ignoreFn?: Function | null,
      includeDescendants?: boolean
    ) => Cell[];

    /**
     * Returns the children of the given parent that are contained in the half-pane from the given point (x0, y0) rightwards or downwards
     * depending on rightHalfpane and bottomHalfpane.
     *
     * @param x0 X-coordinate of the origin.
     * @param y0 Y-coordinate of the origin.
     * @param parent Optional {@link Cell} whose children should be checked. Default is <defaultParent>.
     * @param rightHalfpane Boolean indicating if the cells in the right halfpane from the origin should be returned. Default is `false`.
     * @param bottomHalfpane Boolean indicating if the cells in the bottom halfpane from the origin should be returned. Default is `false`.
     */
    getCellsBeyond: (
      x0: number,
      y0: number,
      parent: Cell | null,
      rightHalfpane: boolean,
      bottomHalfpane: boolean
    ) => Cell[];

    /**
     * Returns the bottom-most cell that intersects the given point (x, y) in the cell hierarchy that starts at the given parent.
     *
     * @param state {@link CellState} that represents the cell state.
     * @param x X-coordinate of the location to be checked.
     * @param y Y-coordinate of the location to be checked.
     */
    intersects: (state: CellState, x: number, y: number) => boolean;

    /**
     * Returns whether the specified parent is a valid ancestor of the specified cell,
     * either direct or indirectly based on whether ancestor recursion is enabled.
     *
     * @param cell {@link Cell} the possible child cell
     * @param parent {@link Cell} the possible parent cell
     * @param recurse boolean whether to recurse the child ancestors. Default is `false`.
     */
    isValidAncestor: (cell: Cell, parent: Cell, recurse: boolean) => boolean;

    /**
     * Returns `true` if the given cell may not be moved, sized, bended, disconnected, edited or selected.
     *
     * This implementation returns `true` for all vertices with a relative geometry if {@link locked} is `false`.
     *
     * @param cell {@link Cell} whose locked state should be returned.
     */
    isCellLocked: (cell: Cell) => boolean;

    isCellsLocked: () => boolean;

    /**
     * Sets if any cell may be moved, sized, bended, disconnected, edited or selected.
     *
     * @param value Boolean that defines the new value for {@link cellsLocked}.
     */
    setCellsLocked: (value: boolean) => void;

    /**
     * Returns the cells which may be exported in the given array of cells.
     */
    getCloneableCells: (cells: Cell[]) => Cell[];

    /**
     * Returns true if the given cell is cloneable.
     *
     * This implementation returns {@link isCellsCloneable} for all cells unless a cell style specifies {@link CellStateStyle.cloneable} to be `false`.
     *
     * @param cell Optional {@link Cell} whose cloneable state should be returned.
     */
    isCellCloneable: (cell: Cell) => boolean;

    /**
     * Returns {@link cellsCloneable}, that is, if the graph allows cloning of cells by using control-drag.
     */
    isCellsCloneable: () => boolean;

    /**
     * Specifies if the graph should allow cloning of cells by holding down the control key while cells are being moved.
     *
     * This implementation updates {@link cellsCloneable}.
     *
     * @param value Boolean indicating if the graph should be cloneable.
     */
    setCellsCloneable: (value: boolean) => void;

    /**
     * Returns the cells which may be exported in the given array of cells.
     */
    getExportableCells: (cells: Cell[]) => Cell[];

    /**
     * Returns true if the given cell may be exported to the clipboard.
     *
     * This implementation returns {@link exportEnabled} for all cells.
     *
     * @param cell {@link Cell} that represents the cell to be exported.
     */
    canExportCell: (cell: Cell | null) => boolean;

    /**
     * Returns the cells which may be imported in the given array of cells.
     */
    getImportableCells: (cells: Cell[]) => Cell[];

    /**
     * Returns true if the given cell may be imported from the clipboard.
     *
     * This implementation returns {@link importEnabled} for all cells.
     *
     * @param cell {@link Cell} that represents the cell to be imported.
     */
    canImportCell: (cell: Cell | null) => boolean;

    /**
     * Returns true if the given cell is selectable.
     *
     * This implementation returns {@link cellsSelectable}.
     *
     * To add a new style for making cells (un)selectable, use the following code.
     *
     * ```javascript
     * isCellSelectable(cell)
     * {
     *   var style = this.getCurrentCellStyle(cell);
     *
     *   return this.isCellsSelectable() && !this.isCellLocked(cell) && style.selectable != 0;
     * };
     * ```
     *
     * You can then use the new style as shown in this example.
     *
     * ```javascript
     * graph.insertVertex(parent, null, 'Hello,', 20, 20, 80, 30, 'selectable=0');
     * ```
     *
     * @param cell {@link Cell} whose selectable state should be returned.
     */
    isCellSelectable: (cell: Cell) => boolean;

    /**
     * Returns {@link cellsSelectable}.
     */
    isCellsSelectable: () => boolean;

    /**
     * Sets {@link cellsSelectable}.
     */
    setCellsSelectable: (value: boolean) => void;

    /**
     * Returns the cells which may be exported in the given array of cells.
     */
    getDeletableCells: (cells: Cell[]) => Cell[];

    /**
     * Returns `true` if the given cell is deletable.
     *
     * @param cell {@link Cell} whose deletable state should be returned.
     * @returns {@link cellsDeletable} for all given cells if a cells style does not specify {@link CellStateStyle.deletable} to be `false`.
     */
    isCellDeletable: (cell: Cell) => boolean;

    /**
     * Returns {@link cellsDeletable}.
     */
    isCellsDeletable: () => boolean;

    /**
     * Sets {@link cellsDeletable}.
     *
     * @param value Boolean indicating if the graph should allow deletion of cells.
     */
    setCellsDeletable: (value: boolean) => void;

    /**
     * Returns `true` if the given cell is rotatable.
     *
     * This returns `true` for the given cell if its style does not specify {@link CellStateStyle.rotatable} to be `false`.
     *
     * @param cell {@link Cell} whose rotatable state should be returned.
     */
    isCellRotatable: (cell: Cell) => boolean;

    /**
     * Returns the cells which are movable in the given array of cells.
     */
    getMovableCells: (cells: Cell[]) => Cell[];

    /**
     * Returns `true` if the given cell is movable.
     *
     * This returns {@link cellsMovable} for all given cells if {@link isCellLocked} does not return `true` for the given cell,
     * and its style does not specify {@link CellStateStyle.movable} to be `false`.
     *
     * @param cell {@link Cell} whose movable state should be returned.
     */
    isCellMovable: (cell: Cell) => boolean;

    /**
     * Returns {@link cellsMovable}.
     */
    isCellsMovable: () => boolean;

    /**
     * Specifies if the graph should allow moving of cells.
     *
     * This implementation updates {@link cellsMovable}.
     *
     * @param value Boolean indicating if the graph should allow moving of cells.
     */
    setCellsMovable: (value: boolean) => void;

    /**
     * Returns true if the given cell is resizable.
     *
     * This returns {@link cellsResizable} for all given cells if {@link isCellLocked} does not return `true` for the given cell
     * and its style does not specify {@link 'resizable'} to be `false`.
     *
     * @param cell {@link Cell} whose resizable state should be returned.
     */
    isCellResizable: (cell: Cell) => boolean;

    /**
     * Returns {@link cellsResizable}.
     */
    isCellsResizable: () => boolean;

    /**
     * Specifies if the graph should allow resizing of cells. This implementation updates {@link cellsResizable}.
     *
     * @param value Boolean indicating if the graph should allow resizing of cells.
     */
    setCellsResizable: (value: boolean) => void;

    /**
     * Returns true if the given cell is bendable.
     *
     * This returns {@link cellsBendable} for all given cells if {@link cellsLocked} does not return `true` for the given cell
     * and its style does not specify {@link CellStateStyle.bendable} to be `false`.
     *
     * @param cell {@link Cell} whose bendable state should be returned.
     */
    isCellBendable: (cell: Cell) => boolean;

    /**
     * Returns {@link cellsBendable}.
     */
    isCellsBendable: () => boolean;

    /**
     * Specifies if the graph should allow bending of edges.
     *
     * This implementation updates {@link cellsBendable}.
     *
     * @param value Boolean indicating if the graph should allow bending of edges.
     */
    setCellsBendable: (value: boolean) => void;

    /**
     * Returns true if the size of the given cell should automatically be updated after a change of the label.
     *
     * This implementation returns {@link autoSizeCells} or checks if the cell style does specify {@link CellStateStyle.autoSize} to be `true`.
     *
     * @param cell {@link Cell} that should be resized.
     */
    isAutoSizeCell: (cell: Cell) => boolean;

    /**
     * Returns {@link autoSizeCells}.
     */
    isAutoSizeCells: () => boolean;

    /**
     * Specifies if cell sizes should be automatically updated after a label change.
     *
     * This implementation sets {@link autoSizeCells} to the given parameter.
     *
     * To update the size of cells when the cells are added, set {@link autoSizeCellsOnAdd} to `true`.
     *
     * @param value Boolean indicating if cells should be resized automatically.
     */
    setAutoSizeCells: (value: boolean) => void;

    /**
     * Returns true if the parent of the given cell should be extended if the child has been resized so that it overlaps the parent.
     *
     * This implementation returns {@link isExtendParents} if the cell is not an edge.
     *
     * @param cell {@link Cell} that has been resized.
     */
    isExtendParent: (cell: Cell) => boolean;

    /**
     * Returns {@link extendParents}.
     */
    isExtendParents: () => boolean;

    /**
     * Sets {@link extendParents}.
     *
     * @param value New boolean value for {@link extendParents}.
     */
    setExtendParents: (value: boolean) => void;

    /**
     * Returns {@link extendParentsOnAdd}.
     */
    isExtendParentsOnAdd: (cell: Cell) => boolean;

    /**
     * Sets {@link extendParentsOnAdd}.
     *
     * @param value New boolean value for {@link extendParentsOnAdd}.
     */
    setExtendParentsOnAdd: (value: boolean) => void;

    /**
     * Returns {@link extendParentsOnMove}.
     */
    isExtendParentsOnMove: () => boolean;

    /**
     * Sets {@link extendParentsOnMove}.
     *
     * @param value New boolean value for {@link extendParentsOnAdd}.
     */
    setExtendParentsOnMove: (value: boolean) => void;

    /**
     * Returns the cursor value to be used for the CSS of the shape for the given cell.
     *
     * This implementation returns `null`.
     *
     * @param cell {@link Cell} whose cursor should be returned.
     */
    getCursorForCell: (cell: Cell) => string | null;

    /**
     * Returns the scaled, translated bounds for the given cell. See {@link GraphView.getBounds} for arrays.
     *
     * @param cell {@link Cell} whose bounds should be returned.
     * @param includeEdges Optional boolean that specifies if the bounds of the connected edges should be included. Default is `false`.
     * @param includeDescendants Optional boolean that specifies if the bounds of all descendants should be included. Default is `false`.
     */
    getCellBounds: (
      cell: Cell,
      includeEdges?: boolean,
      includeDescendants?: boolean
    ) => Rectangle | null;

    /**
     * Returns the bounding box for the geometries of the vertices in the
     * given array of cells. This can be used to find the graph bounds during
     * a layout operation (ie. before the last endUpdate) as follows:
     *
     * ```javascript
     * var cells = graph.getChildCells(graph.getDefaultParent(), true, true);
     * var bounds = graph.getBoundingBoxFromGeometry(cells, true);
     * ```
     *
     * This can then be used to move cells to the origin:
     *
     * ```javascript
     * if (bounds.x < 0 || bounds.y < 0)
     * {
     *   graph.moveCells(cells, -Math.min(bounds.x, 0), -Math.min(bounds.y, 0))
     * }
     * ```
     *
     * Or to translate the graph view:
     *
     * ```javascript
     * if (bounds.x < 0 || bounds.y < 0)
     * {
     *   getView().setTranslate(-Math.min(bounds.x, 0), -Math.min(bounds.y, 0));
     * }
     * ```
     *
     * @param cells Array of {@link Cell} whose bounds should be returned.
     * @param includeEdges Specifies if edge bounds should be included by computing the bounding box for all points in geometry. Default is `false`.
     */
    getBoundingBoxFromGeometry: (
      cells: Cell[],
      includeEdges?: boolean
    ) => Rectangle | null;
  }
}

type PartialGraph = Pick<
  Graph,
  | 'getView'
  | 'getStylesheet'
  | 'batchUpdate'
  | 'getDataModel'
  | 'fireEvent'
  | 'getDefaultParent'
  | 'getCurrentRoot'
  | 'getOverlap'
  | 'isRecursiveResize'
  | 'getCellRenderer'
  | 'getMaximumGraphBounds'
  | 'isExportEnabled'
  | 'isImportEnabled'
  | 'getImageFromBundles'
  | 'getSelectionCells'
  | 'getSelectionCell'
  | 'addAllEdges'
  | 'getAllEdges'
  | 'isCloneInvalidEdges'
  | 'isAllowDanglingEdges'
  | 'resetEdges'
  | 'isResetEdgesOnResize'
  | 'isResetEdgesOnMove'
  | 'isConstrainChild'
  | 'cellConnected'
  | 'isDisconnectOnMove'
  | 'isConstrainRelativeChildren'
  | 'disconnectGraph'
  | 'getEdgeValidationError'
  | 'getFoldingImage'
  | 'isHtmlLabel'
  | 'isGridEnabled'
  | 'snap'
  | 'getGridSize'
  | 'isAllowNegativeCoordinates'
  | 'setAllowNegativeCoordinates'
  | 'getEventTolerance'
  | 'isSwimlane'
  | 'getStartSize'
>;

type PartialCells = Pick<
  Graph,
  | 'cellsResizable'
  | 'cellsBendable'
  | 'cellsSelectable'
  | 'cellsDisconnectable'
  | 'autoSizeCells'
  | 'autoSizeCellsOnAdd'
  | 'cellsLocked'
  | 'cellsCloneable'
  | 'cellsDeletable'
  | 'cellsMovable'
  | 'extendParents'
  | 'extendParentsOnAdd'
  | 'extendParentsOnMove'
  | 'getBoundingBox'
  | 'removeStateForCell'
  | 'getCurrentCellStyle'
  | 'getCellStyle'
  | 'postProcessCellStyle'
  | 'setCellStyle'
  | 'toggleCellStyle'
  | 'toggleCellStyles'
  | 'setCellStyles'
  | 'toggleCellStyleFlags'
  | 'setCellStyleFlags'
  | 'alignCells'
  | 'cloneCell'
  | 'cloneCells'
  | 'addCell'
  | 'addCells'
  | 'cellsAdded'
  | 'autoSizeCell'
  | 'removeCells'
  | 'cellsRemoved'
  | 'toggleCells'
  | 'cellsToggled'
  | 'updateCellSize'
  | 'cellSizeUpdated'
  | 'getPreferredSizeForCell'
  | 'resizeCell'
  | 'resizeCells'
  | 'cellResized'
  | 'cellsResized'
  | 'resizeChildCells'
  | 'constrainChildCells'
  | 'scaleCell'
  | 'extendParent'
  | 'importCells'
  | 'moveCells'
  | 'cellsMoved'
  | 'translateCell'
  | 'getCellContainmentArea'
  | 'constrainChild'
  | 'getChildCells'
  | 'getCellAt'
  | 'getCells'
  | 'getCellsBeyond'
  | 'intersects'
  | 'isValidAncestor'
  | 'isCellLocked'
  | 'isCellsLocked'
  | 'setCellsLocked'
  | 'getCloneableCells'
  | 'isCellCloneable'
  | 'isCellsCloneable'
  | 'setCellsCloneable'
  | 'getExportableCells'
  | 'canExportCell'
  | 'getImportableCells'
  | 'canImportCell'
  | 'isCellSelectable'
  | 'isCellsSelectable'
  | 'setCellsSelectable'
  | 'getDeletableCells'
  | 'isCellDeletable'
  | 'isCellsDeletable'
  | 'setCellsDeletable'
  | 'isCellRotatable'
  | 'getMovableCells'
  | 'isCellMovable'
  | 'isCellsMovable'
  | 'setCellsMovable'
  | 'isCellResizable'
  | 'isCellsResizable'
  | 'setCellsResizable'
  | 'isCellBendable'
  | 'isCellsBendable'
  | 'setCellsBendable'
  | 'isAutoSizeCell'
  | 'isAutoSizeCells'
  | 'setAutoSizeCells'
  | 'isExtendParent'
  | 'isExtendParents'
  | 'setExtendParents'
  | 'isExtendParentsOnAdd'
  | 'setExtendParentsOnAdd'
  | 'isExtendParentsOnMove'
  | 'setExtendParentsOnMove'
  | 'getCursorForCell'
  | 'getCellBounds'
  | 'getBoundingBoxFromGeometry'
>;
type PartialType = PartialGraph & PartialCells;

// @ts-expect-error The properties of PartialGraph are defined elsewhere.
export const CellsMixin: PartialType = {
  cellsResizable: true,

  cellsBendable: true,

  cellsSelectable: true,

  cellsDisconnectable: true,

  autoSizeCells: false,

  autoSizeCellsOnAdd: false,

  cellsLocked: false,

  cellsCloneable: true,

  cellsDeletable: true,

  cellsMovable: true,

  extendParents: true,

  extendParentsOnAdd: true,

  extendParentsOnMove: false,

  getBoundingBox(cells) {
    let result = null;

    if (cells.length > 0) {
      for (const cell of cells) {
        if (cell.isVertex() || cell.isEdge()) {
          const bbox = this.getView().getBoundingBox(this.getView().getState(cell), true);

          if (bbox) {
            if (!result) {
              result = Rectangle.fromRectangle(bbox);
            } else {
              result.add(bbox);
            }
          }
        }
      }
    }
    return result;
  },

  removeStateForCell(cell) {
    for (const child of cell.getChildren()) {
      this.removeStateForCell(child);
    }

    this.getView().invalidate(cell, false, true);
    this.getView().removeState(cell);
  },

  /*****************************************************************************
   * Group: Cell styles
   *****************************************************************************/

  getCurrentCellStyle(cell, ignoreState = false) {
    const state = ignoreState ? null : this.getView().getState(cell);
    return state ? state.style : this.getCellStyle(cell);
  },

  getCellStyle(cell) {
    const cellStyle = cell.getStyle();
    const stylesheet = this.getStylesheet();

    // Gets the default style for the cell
    const defaultStyle = cell.isEdge()
      ? stylesheet.getDefaultEdgeStyle()
      : stylesheet.getDefaultVertexStyle();

    // Resolves the stylename using the above as the default
    const style = this.postProcessCellStyle(
      stylesheet.getCellStyle(cellStyle, defaultStyle ?? {})
    );

    return style;
  },

  postProcessCellStyle(style) {
    if (!style.image) {
      return style;
    }
    const key = <string>style.image;
    let image = this.getImageFromBundles(key);

    if (image) {
      style.image = image;
    } else {
      image = key;
    }

    // Converts short data uris to normal data uris
    if (image && image.substring(0, 11) === 'data:image/') {
      if (image.substring(0, 20) === 'data:image/svg+xml,<') {
        // Required for FF and IE11
        image = image.substring(0, 19) + encodeURIComponent(image.substring(19));
      } else if (image.substring(0, 22) !== 'data:image/svg+xml,%3C') {
        const comma = image.indexOf(',');

        // Adds base64 encoding prefix if needed
        if (comma > 0 && image.substring(comma - 7, comma + 1) !== ';base64,') {
          image = `${image.substring(0, comma)};base64,${image.substring(comma + 1)}`;
        }
      }

      style.image = image;
    }

    return style;
  },

  setCellStyle(style, cells?) {
    cells = cells ?? this.getSelectionCells();

    this.batchUpdate(() => {
      for (const cell of cells!) {
        this.getDataModel().setStyle(cell, style);
      }
    });
  },

  toggleCellStyle(key, defaultValue = false, cell?) {
    cell = cell ?? this.getSelectionCell();
    return this.toggleCellStyles(key, defaultValue, [cell]);
  },

  toggleCellStyles(key, defaultValue = false, cells?) {
    let value = false;

    cells = cells ?? this.getSelectionCells();

    if (cells.length > 0) {
      const style = this.getCurrentCellStyle(cells[0]);
      value = style[key] ?? defaultValue ? false : true;
      this.setCellStyles(key, value, cells);
    }

    return value;
  },

  setCellStyles(key, value, cells) {
    cells = cells ?? this.getSelectionCells();

    setCellStyles(this.getDataModel(), cells, key, value);
  },

  toggleCellStyleFlags(key, flag, cells) {
    cells = cells ?? this.getSelectionCells();

    this.setCellStyleFlags(key, flag, null, cells);
  },

  setCellStyleFlags(key, flag, value = null, cells) {
    cells = cells ?? this.getSelectionCells();

    if (cells.length > 0) {
      if (value === null) {
        const style = this.getCurrentCellStyle(cells[0]);

        const current = (style[key] as number) || 0;
        value = !((current & flag) === flag);
      }
      setCellStyleFlags(this.getDataModel(), cells, key, flag, value);
    }
  },

  /*****************************************************************************
   * Group: Cell alignment and orientation
   *****************************************************************************/

  alignCells(align, cells, param = null) {
    cells = cells ?? this.getSelectionCells();

    if (cells.length > 1) {
      // Finds the required coordinate for the alignment
      if (param === null) {
        for (const cell of cells) {
          const state = this.getView().getState(cell);

          if (state && !cell.isEdge()) {
            if (param === null) {
              if (align === ALIGN.CENTER) {
                param = state.x + state.width / 2;
                break;
              } else if (align === ALIGN.RIGHT) {
                param = state.x + state.width;
              } else if (align === ALIGN.TOP) {
                param = state.y;
              } else if (align === ALIGN.MIDDLE) {
                param = state.y + state.height / 2;
                break;
              } else if (align === ALIGN.BOTTOM) {
                param = state.y + state.height;
              } else {
                param = state.x;
              }
            } else if (align === ALIGN.RIGHT) {
              param = Math.max(param, state.x + state.width);
            } else if (align === ALIGN.TOP) {
              param = Math.min(param, state.y);
            } else if (align === ALIGN.BOTTOM) {
              param = Math.max(param, state.y + state.height);
            } else {
              param = Math.min(param, state.x);
            }
          }
        }
      }

      // Aligns the cells to the coordinate
      if (param !== null) {
        const s = this.getView().scale;

        this.batchUpdate(() => {
          const p = param as number;

          for (const cell of cells as Cell[]) {
            const state = this.getView().getState(cell);

            if (state != null) {
              let geo = cell.getGeometry();

              if (geo != null && !cell.isEdge()) {
                geo = geo.clone();

                if (align === ALIGN.CENTER) {
                  geo.x += (p - state.x - state.width / 2) / s;
                } else if (align === ALIGN.RIGHT) {
                  geo.x += (p - state.x - state.width) / s;
                } else if (align === ALIGN.TOP) {
                  geo.y += (p - state.y) / s;
                } else if (align === ALIGN.MIDDLE) {
                  geo.y += (p - state.y - state.height / 2) / s;
                } else if (align === ALIGN.BOTTOM) {
                  geo.y += (p - state.y - state.height) / s;
                } else {
                  geo.x += (p - state.x) / s;
                }

                this.resizeCell(cell, geo);
              }
            }
          }

          this.fireEvent(new EventObject(InternalEvent.ALIGN_CELLS, { align, cells }));
        });
      }
    }

    return cells;
  },

  /*****************************************************************************
   * Group: Cell cloning, insertion and removal
   *****************************************************************************/

  cloneCell(cell, allowInvalidEdges = false, mapping = {}, keepPosition = false) {
    return this.cloneCells([cell], allowInvalidEdges, mapping, keepPosition)[0];
  },

  cloneCells(cells, allowInvalidEdges = true, mapping = {}, keepPosition = false) {
    let clones: Cell[];

    // Creates a dictionary for fast lookups
    const dict = new Dictionary<Cell, boolean>();
    const tmp = [];

    for (const cell of cells) {
      dict.put(cell, true);
      tmp.push(cell);
    }

    if (tmp.length > 0) {
      const { scale } = this.getView();
      const trans = this.getView().translate;
      const out: Cell[] = [];
      clones = cloneCells(cells, true, mapping);

      for (let i = 0; i < cells.length; i += 1) {
        const cell = cells[i];
        const clone = clones[i];

        if (
          !allowInvalidEdges &&
          clone.isEdge() &&
          this.getEdgeValidationError(
            clone,
            clone.getTerminal(true),
            clone.getTerminal(false)
          ) !== null
        ) {
          //clones[i] = null;
        } else {
          out.push(clone);
          const g = clone.getGeometry();

          if (g) {
            const state = this.getView().getState(cell);
            const parent = cell.getParent();
            const pstate = parent ? this.getView().getState(parent) : null;

            if (state && pstate) {
              const dx = keepPosition ? 0 : (<Point>pstate.origin).x;
              const dy = keepPosition ? 0 : (<Point>pstate.origin).y;

              if (clone.isEdge()) {
                const pts = state.absolutePoints;

                // Checks if the source is cloned or sets the terminal point
                let src = cell.getTerminal(true);

                while (src && !dict.get(src)) {
                  src = src.getParent();
                }

                if (!src && pts[0]) {
                  g.setTerminalPoint(
                    new Point(pts[0].x / scale - trans.x, pts[0].y / scale - trans.y),
                    true
                  );
                }

                // Checks if the target is cloned or sets the terminal point
                let trg = cell.getTerminal(false);
                while (trg && !dict.get(trg)) {
                  trg = trg.getParent();
                }

                const n = pts.length - 1;
                const p = pts[n];

                if (!trg && p) {
                  g.setTerminalPoint(
                    new Point(p.x / scale - trans.x, p.y / scale - trans.y),
                    false
                  );
                }

                // Translates the control points
                const { points } = g;
                if (points) {
                  for (const point of points) {
                    point.x += dx;
                    point.y += dy;
                  }
                }
              } else {
                g.translate(dx, dy);
              }
            }
          }
        }
      }
      clones = out;
    } else {
      clones = [];
    }
    return clones;
  },

  addCell(cell, parent = null, index = null, source = null, target = null) {
    return this.addCells([cell], parent, index, source, target)[0];
  },

  addCells(
    cells,
    parent = null,
    index = null,
    source = null,
    target = null,
    absolute = false
  ) {
    const p = parent ?? this.getDefaultParent();
    const i = index ?? p.getChildCount();

    this.batchUpdate(() => {
      this.cellsAdded(cells, p, i, source, target, absolute, true);
      this.fireEvent(
        new EventObject(InternalEvent.ADD_CELLS, { cells, p, i, source, target })
      );
    });

    return cells;
  },

  cellsAdded(
    cells,
    parent,
    index,
    source = null,
    target = null,
    absolute = false,
    constrain = false,
    extend = true
  ) {
    this.batchUpdate(() => {
      const parentState = absolute ? this.getView().getState(parent) : null;
      const o1 = parentState ? parentState.origin : null;
      const zero = new Point(0, 0);

      cells.forEach((cell, i) => {
        /* Can cells include null values?
        if (cell == null) {
          index--;
        } else {
        */
        const previous = cell.getParent();

        // Keeps the cell at its absolute location
        if (o1 && cell !== parent && parent !== previous) {
          const oldState = previous ? this.getView().getState(previous) : null;
          const o2 = oldState ? oldState.origin : zero;
          let geo = cell.getGeometry();

          if (geo) {
            const dx = o2.x - o1.x;
            const dy = o2.y - o1.y;

            // FIXME: Cells should always be inserted first before any other edit
            // to avoid forward references in sessions.
            geo = geo.clone();
            geo.translate(dx, dy);

            if (!geo.relative && cell.isVertex() && !this.isAllowNegativeCoordinates()) {
              geo.x = Math.max(0, geo.x);
              geo.y = Math.max(0, geo.y);
            }

            this.getDataModel().setGeometry(cell, geo);
          }
        }

        // Decrements all following indices
        // if cell is already in parent
        if (parent === previous && index + i > parent.getChildCount()) {
          index--;
        }

        this.getDataModel().add(parent, cell, index + i);

        if (this.autoSizeCellsOnAdd) {
          this.autoSizeCell(cell, true);
        }

        // Extends the parent or constrains the child
        if (
          (!extend || extend) &&
          this.isExtendParentsOnAdd(cell) &&
          this.isExtendParent(cell)
        ) {
          this.extendParent(cell);
        }

        // Additionally constrains the child after extending the parent
        if (!constrain || constrain) {
          this.constrainChild(cell);
        }

        // Sets the source terminal
        if (source) {
          this.cellConnected(cell, source, true);
        }

        // Sets the target terminal
        if (target) {
          this.cellConnected(cell, target, false);
        }
        /*}*/
      });

      this.fireEvent(
        new EventObject(InternalEvent.CELLS_ADDED, {
          cells,
          parent,
          index,
          source,
          target,
          absolute,
        })
      );
    });
  },

  autoSizeCell(cell, recurse = true) {
    if (recurse) {
      for (const child of cell.getChildren()) {
        this.autoSizeCell(child);
      }
    }

    if (cell.isVertex() && this.isAutoSizeCell(cell)) {
      this.updateCellSize(cell);
    }
  },

  removeCells(cells = null, includeEdges = true) {
    if (!cells) {
      cells = this.getDeletableCells(this.getSelectionCells());
    }

    // Adds all edges to the cells
    if (includeEdges) {
      // FIXME: Remove duplicate cells in result or do not add if
      // in cells or descendant of cells
      cells = this.getDeletableCells(this.addAllEdges(cells));
    } else {
      cells = cells.slice();

      // Removes edges that are currently not
      // visible as those cannot be updated
      const edges = this.getDeletableCells(this.getAllEdges(cells));
      const dict = new Dictionary<Cell, boolean>();

      for (const cell of cells) {
        dict.put(cell, true);
      }

      for (const edge of edges) {
        if (!this.getView().getState(edge) && !dict.get(edge)) {
          dict.put(edge, true);
          cells.push(edge);
        }
      }
    }

    this.batchUpdate(() => {
      this.cellsRemoved(cells as Cell[]);
      this.fireEvent(
        new EventObject(InternalEvent.REMOVE_CELLS, { cells, includeEdges })
      );
    });

    return cells ?? [];
  },

  cellsRemoved(cells) {
    if (cells.length > 0) {
      const { scale } = this.getView();
      const tr = this.getView().translate;

      this.batchUpdate(() => {
        // Creates hashtable for faster lookup
        const dict = new Dictionary<Cell, boolean>();

        for (const cell of cells) {
          dict.put(cell, true);
        }

        for (const cell of cells) {
          // Disconnects edges which are not being removed
          const edges = this.getAllEdges([cell]);

          const disconnectTerminal = (edge: Cell, source: boolean) => {
            let geo = edge.getGeometry();

            if (geo) {
              // Checks if terminal is being removed
              const terminal = edge.getTerminal(source);
              let connected = false;
              let tmp = terminal;

              while (tmp) {
                if (cell === tmp) {
                  connected = true;
                  break;
                }
                tmp = tmp.getParent();
              }

              if (connected) {
                geo = geo.clone();
                const state = this.getView().getState(edge);

                if (state) {
                  const pts = state.absolutePoints;
                  const n = source ? 0 : pts.length - 1;
                  const p = pts[n] as Point;

                  geo.setTerminalPoint(
                    new Point(
                      p.x / scale - tr.x - state.origin.x,
                      p.y / scale - tr.y - state.origin.y
                    ),
                    source
                  );
                } else if (terminal) {
                  // Fallback to center of terminal if routing
                  // points are not available to add new point
                  // KNOWN: Should recurse to find parent offset
                  // of edge for nested groups but invisible edges
                  // should be removed in removeCells step
                  const tstate = this.getView().getState(terminal);

                  if (tstate) {
                    geo.setTerminalPoint(
                      new Point(
                        tstate.getCenterX() / scale - tr.x,
                        tstate.getCenterY() / scale - tr.y
                      ),
                      source
                    );
                  }
                }

                this.getDataModel().setGeometry(edge, geo);
                this.getDataModel().setTerminal(edge, null, source);
              }
            }
          };

          for (const edge of edges) {
            if (!dict.get(edge)) {
              dict.put(edge, true);
              disconnectTerminal(edge, true);
              disconnectTerminal(edge, false);
            }
          }

          this.getDataModel().remove(cell);
        }

        this.fireEvent(new EventObject(InternalEvent.CELLS_REMOVED, { cells }));
      });
    }
  },

  /*****************************************************************************
   * Group: Cell visibility
   *****************************************************************************/

  toggleCells(show = false, cells, includeEdges = true) {
    cells = cells ?? this.getSelectionCells();

    // Adds all connected edges recursively
    if (includeEdges) {
      cells = this.addAllEdges(cells);
    }

    this.batchUpdate(() => {
      this.cellsToggled(cells, show);
      this.fireEvent(
        new EventObject(InternalEvent.TOGGLE_CELLS, { show, cells, includeEdges })
      );
    });
    return cells;
  },

  cellsToggled(cells, show = false) {
    if (cells.length > 0) {
      this.batchUpdate(() => {
        for (const cell of cells) {
          this.getDataModel().setVisible(cell, show);
        }
      });
    }
  },

  /*****************************************************************************
   * Group: Cell sizing
   *****************************************************************************/

  updateCellSize(cell, ignoreChildren = false) {
    this.batchUpdate(() => {
      this.cellSizeUpdated(cell, ignoreChildren);
      this.fireEvent(
        new EventObject(InternalEvent.UPDATE_CELL_SIZE, { cell, ignoreChildren })
      );
    });
    return cell;
  },

  cellSizeUpdated(cell, ignoreChildren = false) {
    this.batchUpdate(() => {
      const size = this.getPreferredSizeForCell(cell);
      let geo = cell.getGeometry();

      if (size && geo) {
        const collapsed = cell.isCollapsed();
        geo = geo.clone();

        if (this.isSwimlane(cell)) {
          const style = this.getCellStyle(cell);
          const cellStyle = cell.getStyle();

          if (style.horizontal ?? true) {
            cellStyle.startSize = size.height + 8;

            if (collapsed) {
              geo.height = size.height + 8;
            }

            geo.width = size.width;
          } else {
            cellStyle.startSize = size.width + 8;

            if (collapsed) {
              geo.width = size.width + 8;
            }

            geo.height = size.height;
          }

          this.getDataModel().setStyle(cell, cellStyle);
        } else {
          const state = this.getView().createState(cell);
          const align = state.style.align ?? ALIGN.CENTER;

          if (align === ALIGN.RIGHT) {
            geo.x += geo.width - size.width;
          } else if (align === ALIGN.CENTER) {
            geo.x += Math.round((geo.width - size.width) / 2);
          }

          const valign = state.getVerticalAlign();

          if (valign === ALIGN.BOTTOM) {
            geo.y += geo.height - size.height;
          } else if (valign === ALIGN.MIDDLE) {
            geo.y += Math.round((geo.height - size.height) / 2);
          }

          geo.width = size.width;
          geo.height = size.height;
        }

        if (!ignoreChildren && !collapsed) {
          const bounds = this.getView().getBounds(cell.getChildren());

          if (bounds != null) {
            const tr = this.getView().translate;
            const { scale } = this.getView();

            const width = (bounds.x + bounds.width) / scale - geo.x - tr.x;
            const height = (bounds.y + bounds.height) / scale - geo.y - tr.y;

            geo.width = Math.max(geo.width, width);
            geo.height = Math.max(geo.height, height);
          }
        }

        this.cellsResized([cell], [geo], false);
      }
    });
  },

  getPreferredSizeForCell(cell, textWidth = null) {
    let result = null;

    const state = this.getView().createState(cell);
    const { style } = state;

    if (!cell.isEdge()) {
      const fontSize = style.fontSize || DEFAULT_FONTSIZE;
      let dx = 0;
      let dy = 0;

      // Adds dimension of image if shape is a label
      if (state.getImageSrc() || style.image) {
        if (style.shape === SHAPE.LABEL) {
          if (style.verticalAlign === ALIGN.MIDDLE) {
            dx += style.imageWidth || DEFAULT_IMAGESIZE;
          }

          if (style.align !== ALIGN.CENTER) {
            dy += style.imageHeight || DEFAULT_IMAGESIZE;
          }
        }
      }

      // Adds spacings
      dx += 2 * (style.spacing || 0);
      dx += style.spacingLeft || 0;
      dx += style.spacingRight || 0;

      dy += 2 * (style.spacing || 0);
      dy += style.spacingTop || 0;
      dy += style.spacingBottom || 0;

      // Add spacing for collapse/expand icon
      // LATER: Check alignment and use constants
      // for image spacing
      const image = this.getFoldingImage(state);

      if (image) {
        dx += image.width + 8;
      }

      // Adds space for label
      let value = <string>this.getCellRenderer().getLabelValue(state);

      if (value && value.length > 0) {
        if (!this.isHtmlLabel(state.cell)) {
          value = htmlEntities(value, false);
        }

        value = value.replace(/\n/g, '<br>');

        const size = getSizeForString(
          value,
          fontSize,
          style.fontFamily,
          textWidth,
          style.fontStyle
        );
        let width = size.width + dx;
        let height = size.height + dy;

        if (!(style.horizontal ?? true)) {
          const tmp = height;
          height = width;
          width = tmp;
        }

        if (this.isGridEnabled()) {
          width = this.snap(width + this.getGridSize() / 2);
          height = this.snap(height + this.getGridSize() / 2);
        }

        result = new Rectangle(0, 0, width, height);
      } else {
        const gs2 = 4 * this.getGridSize();
        result = new Rectangle(0, 0, gs2, gs2);
      }
    }

    return result;
  },

  resizeCell(cell, bounds, recurse = false) {
    return this.resizeCells([cell], [bounds], recurse)[0];
  },

  resizeCells(cells, bounds, recurse): Cell[] {
    recurse = recurse ?? this.isRecursiveResize();

    this.batchUpdate(() => {
      const prev = this.cellsResized(cells, bounds, recurse);
      this.fireEvent(
        new EventObject(InternalEvent.RESIZE_CELLS, { cells, bounds, prev })
      );
    });
    return cells;
  },

  cellsResized(cells, bounds, recurse = false) {
    const prev: (Geometry | null)[] = [];

    if (cells.length === bounds.length) {
      this.batchUpdate(() => {
        cells.forEach((cell, i) => {
          prev.push(this.cellResized(cell, bounds[i], false, recurse));

          if (this.isExtendParent(cell)) {
            this.extendParent(cell);
          }

          this.constrainChild(cell);
        });

        if (this.isResetEdgesOnResize()) {
          this.resetEdges(cells);
        }

        this.fireEvent(
          new EventObject(InternalEvent.CELLS_RESIZED, { cells, bounds, prev })
        );
      });
    }
    return prev;
  },

  cellResized(cell, bounds, ignoreRelative = false, recurse = false) {
    const prev = cell.getGeometry();

    if (
      prev &&
      (prev.x !== bounds.x ||
        prev.y !== bounds.y ||
        prev.width !== bounds.width ||
        prev.height !== bounds.height)
    ) {
      const geo = prev.clone();

      if (!ignoreRelative && geo.relative) {
        const { offset } = geo;

        if (offset) {
          offset.x += bounds.x - geo.x;
          offset.y += bounds.y - geo.y;
        }
      } else {
        geo.x = bounds.x;
        geo.y = bounds.y;
      }

      geo.width = bounds.width;
      geo.height = bounds.height;

      if (!geo.relative && cell.isVertex() && !this.isAllowNegativeCoordinates()) {
        geo.x = Math.max(0, geo.x);
        geo.y = Math.max(0, geo.y);
      }

      this.batchUpdate(() => {
        if (recurse) {
          this.resizeChildCells(cell, geo);
        }

        this.getDataModel().setGeometry(cell, geo);
        this.constrainChildCells(cell);
      });
    }

    return prev;
  },

  resizeChildCells(cell, newGeo) {
    const geo = cell.getGeometry();

    if (geo) {
      const dx = geo.width !== 0 ? newGeo.width / geo.width : 1;
      const dy = geo.height !== 0 ? newGeo.height / geo.height : 1;

      for (const child of cell.getChildren()) {
        this.scaleCell(child, dx, dy, true);
      }
    }
  },

  constrainChildCells(cell) {
    for (const child of cell.getChildren()) {
      this.constrainChild(child);
    }
  },

  scaleCell(cell, dx, dy, recurse = false) {
    let geo = cell.getGeometry();

    if (geo) {
      const style = this.getCurrentCellStyle(cell);
      geo = geo.clone();

      // Stores values for restoring based on style
      const { x } = geo;
      const { y } = geo;
      const w = geo.width;
      const h = geo.height;

      geo.scale(dx, dy, style.aspect === 'fixed');

      if (style.resizeWidth) {
        geo.width = w * dx;
      } else if (!style.resizeWidth) {
        geo.width = w;
      }

      if (style.resizeHeight) {
        geo.height = h * dy;
      } else if (!style.resizeHeight) {
        geo.height = h;
      }

      if (!this.isCellMovable(cell)) {
        geo.x = x;
        geo.y = y;
      }

      if (!this.isCellResizable(cell)) {
        geo.width = w;
        geo.height = h;
      }

      if (cell.isVertex()) {
        this.cellResized(cell, geo, true, recurse);
      } else {
        this.getDataModel().setGeometry(cell, geo);
      }
    }
  },

  extendParent(cell) {
    const parent = cell.getParent();
    let p = parent ? parent.getGeometry() : null;

    if (parent && p && !parent.isCollapsed()) {
      const geo = cell.getGeometry();

      if (
        geo &&
        !geo.relative &&
        (p.width < geo.x + geo.width || p.height < geo.y + geo.height)
      ) {
        p = p.clone();

        p.width = Math.max(p.width, geo.x + geo.width);
        p.height = Math.max(p.height, geo.y + geo.height);

        this.cellsResized([parent], [p], false);
      }
    }
  },

  // *************************************************************************************
  // Group: Cell moving
  // *************************************************************************************

  importCells(cells, dx?: number, dy?: number, target = null, evt = null, mapping = {}) {
    return this.moveCells(cells, dx, dy, true, target, evt, mapping);
  },

  moveCells(
    cells,
    dx = 0,
    dy = 0,
    clone = false,
    target = null,
    evt = null,
    mapping = {}
  ) {
    if (dx !== 0 || dy !== 0 || clone || target) {
      // Removes descendants with ancestors in cells to avoid multiple moving
      cells = getTopmostCells(cells);
      const origCells = cells;

      this.batchUpdate(() => {
        // Faster cell lookups to remove relative edge labels with selected
        // terminals to avoid explicit and implicit move at same time
        const dict = new Dictionary<Cell, boolean>();

        for (const cell of cells) {
          dict.put(cell, true);
        }

        const isSelected = (cell: Cell | null) => {
          while (cell) {
            if (dict.get(cell)) {
              return true;
            }
            cell = cell.getParent();
          }
          return false;
        };

        // Removes relative edge labels with selected terminals
        const checked = [];

        for (const cell of cells) {
          const geo = cell.getGeometry();
          const parent = cell.getParent();

          if (
            !geo ||
            !geo.relative ||
            (parent && !parent.isEdge()) ||
            (parent &&
              !isSelected(parent.getTerminal(true)) &&
              !isSelected(parent.getTerminal(false)))
          ) {
            checked.push(cell);
          }
        }

        cells = checked;

        if (clone) {
          cells = this.cloneCells(cells, this.isCloneInvalidEdges(), mapping);

          if (!target) {
            target = this.getDefaultParent();
          }
        }

        // FIXME: Cells should always be inserted first before any other edit
        // to avoid forward references in sessions.
        // Need to disable allowNegativeCoordinates if target not null to
        // allow for temporary negative numbers until cellsAdded is called.
        const previous = this.isAllowNegativeCoordinates();

        if (target) {
          this.setAllowNegativeCoordinates(true);
        }

        this.cellsMoved(
          cells,
          dx,
          dy,
          !clone && this.isDisconnectOnMove() && this.isAllowDanglingEdges(),
          !target,
          this.isExtendParentsOnMove() && !target
        );

        this.setAllowNegativeCoordinates(previous);

        if (target) {
          const index = target.getChildCount();
          this.cellsAdded(cells, target, index, null, null, true);

          // Restores parent edge on cloned edge labels
          if (clone) {
            cells.forEach((cell, i) => {
              const geo = cell.getGeometry();
              const parent = origCells[i].getParent();

              if (
                geo &&
                geo.relative &&
                parent &&
                parent.isEdge() &&
                this.getDataModel().contains(parent)
              ) {
                this.getDataModel().add(parent, cell);
              }
            });
          }
        }

        // Dispatches a move event
        this.fireEvent(
          new EventObject(InternalEvent.MOVE_CELLS, {
            cells,
            dx,
            dy,
            clone,
            target,
            event: evt,
          })
        );
      });
    }
    return cells;
  },

  cellsMoved(cells, dx, dy, disconnect = false, constrain = false, extend = false) {
    if (dx !== 0 || dy !== 0) {
      this.batchUpdate(() => {
        if (disconnect) {
          this.disconnectGraph(cells);
        }

        for (const cell of cells) {
          this.translateCell(cell, dx, dy);

          if (extend && this.isExtendParent(cell)) {
            this.extendParent(cell);
          } else if (constrain) {
            this.constrainChild(cell);
          }
        }

        if (this.isResetEdgesOnMove()) {
          this.resetEdges(cells);
        }

        this.fireEvent(
          new EventObject(InternalEvent.CELLS_MOVED, { cells, dx, dy, disconnect })
        );
      });
    }
  },

  translateCell(cell, dx, dy) {
    let geometry = cell.getGeometry();

    if (geometry) {
      geometry = geometry.clone();
      geometry.translate(dx, dy);

      if (!geometry.relative && cell.isVertex() && !this.isAllowNegativeCoordinates()) {
        geometry.x = Math.max(0, geometry.x);
        geometry.y = Math.max(0, geometry.y);
      }

      if (geometry.relative && !cell.isEdge()) {
        const parent = <Cell>cell.getParent();
        let angle = 0;

        if (parent.isVertex()) {
          const style = this.getCurrentCellStyle(parent);
          angle = style.rotation ?? 0;
        }

        if (angle !== 0) {
          const rad = toRadians(-angle);
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const pt = getRotatedPoint(new Point(dx, dy), cos, sin, new Point(0, 0));
          dx = pt.x;
          dy = pt.y;
        }

        if (!geometry.offset) {
          geometry.offset = new Point(dx, dy);
        } else {
          geometry.offset.x = geometry.offset.x + dx;
          geometry.offset.y = geometry.offset.y + dy;
        }
      }
      this.getDataModel().setGeometry(cell, geometry);
    }
  },

  getCellContainmentArea(cell) {
    if (!cell.isEdge()) {
      const parent = cell.getParent();

      if (parent && parent !== this.getDefaultParent()) {
        const g = parent.getGeometry();

        if (g) {
          let x = 0;
          let y = 0;
          let w = g.width;
          let h = g.height;

          if (this.isSwimlane(parent)) {
            const size = this.getStartSize(parent);
            const style = this.getCurrentCellStyle(parent);
            const dir = style.direction ?? DIRECTION.EAST;
            const flipH = style.flipH ?? false;
            const flipV = style.flipV ?? false;

            if (dir === DIRECTION.SOUTH || dir === DIRECTION.NORTH) {
              const tmp = size.width;
              size.width = size.height;
              size.height = tmp;
            }

            if (
              (dir === DIRECTION.EAST && !flipV) ||
              (dir === DIRECTION.NORTH && !flipH) ||
              (dir === DIRECTION.WEST && flipV) ||
              (dir === DIRECTION.SOUTH && flipH)
            ) {
              x = size.width;
              y = size.height;
            }

            w -= size.width;
            h -= size.height;
          }

          return new Rectangle(x, y, w, h);
        }
      }
    }
    return null;
  },

  constrainChild(cell, sizeFirst = true) {
    let geo = cell.getGeometry();

    if (geo && (this.isConstrainRelativeChildren() || !geo.relative)) {
      const parent = cell.getParent();
      let max = this.getMaximumGraphBounds();

      // Finds parent offset
      if (max && parent) {
        const off = this.getBoundingBoxFromGeometry([parent], false);

        if (off) {
          max = Rectangle.fromRectangle(max);

          max.x -= off.x;
          max.y -= off.y;
        }
      }

      if (this.isConstrainChild(cell)) {
        let tmp = this.getCellContainmentArea(cell);

        if (tmp) {
          const overlap = this.getOverlap(cell);

          if (overlap > 0) {
            tmp = Rectangle.fromRectangle(tmp);

            tmp.x -= tmp.width * overlap;
            tmp.y -= tmp.height * overlap;
            tmp.width += 2 * tmp.width * overlap;
            tmp.height += 2 * tmp.height * overlap;
          }

          // Find the intersection between max and tmp
          if (!max) {
            max = tmp;
          } else {
            max = Rectangle.fromRectangle(max);
            max.intersect(tmp);
          }
        }
      }

      if (max) {
        const cells = [cell];

        if (!cell.isCollapsed()) {
          const desc = cell.getDescendants();

          for (const descItem of desc) {
            if (descItem.isVisible()) {
              cells.push(descItem);
            }
          }
        }

        const bbox = this.getBoundingBoxFromGeometry(cells, false);

        if (bbox) {
          geo = geo.clone();

          // Cumulative horizontal movement
          let dx = 0;

          if (geo.width > max.width) {
            dx = geo.width - max.width;
            geo.width -= dx;
          }

          if (bbox.x + bbox.width > max.x + max.width) {
            dx -= bbox.x + bbox.width - max.x - max.width - dx;
          }

          // Cumulative vertical movement
          let dy = 0;

          if (geo.height > max.height) {
            dy = geo.height - max.height;
            geo.height -= dy;
          }

          if (bbox.y + bbox.height > max.y + max.height) {
            dy -= bbox.y + bbox.height - max.y - max.height - dy;
          }

          if (bbox.x < max.x) {
            dx -= bbox.x - max.x;
          }

          if (bbox.y < max.y) {
            dy -= bbox.y - max.y;
          }

          if (dx !== 0 || dy !== 0) {
            if (geo.relative) {
              // Relative geometries are moved via absolute offset
              if (!geo.offset) {
                geo.offset = new Point();
              }

              geo.offset.x += dx;
              geo.offset.y += dy;
            } else {
              geo.x += dx;
              geo.y += dy;
            }
          }
          this.getDataModel().setGeometry(cell, geo);
        }
      }
    }
  },

  /*****************************************************************************
   * Group: Cell retrieval
   *****************************************************************************/

  getChildCells(parent, vertices = false, edges = false) {
    parent = parent ?? this.getDefaultParent();

    const cells = parent.getChildCells(vertices, edges);
    const result = [];

    // Filters out the non-visible child cells
    for (const cell of cells) {
      if (cell.isVisible()) {
        result.push(cell);
      }
    }
    return result;
  },

  getCellAt(x, y, parent = null, vertices = true, edges = true, ignoreFn = null) {
    if (!parent) {
      parent = this.getCurrentRoot();

      if (!parent) {
        parent = this.getDataModel().getRoot();
      }
    }

    if (parent) {
      const childCount = parent.getChildCount();

      for (let i = childCount - 1; i >= 0; i--) {
        const cell = parent.getChildAt(i);
        const result = this.getCellAt(x, y, cell, vertices, edges, ignoreFn);

        if (result) {
          return result;
        }
        if (
          cell.isVisible() &&
          ((edges && cell.isEdge()) || (vertices && cell.isVertex()))
        ) {
          const state = this.getView().getState(cell);

          if (
            state &&
            (!ignoreFn || !ignoreFn(state, x, y)) &&
            this.intersects(state, x, y)
          ) {
            return cell;
          }
        }
      }
    }
    return null;
  },

  getCells(
    x,
    y,
    width,
    height,
    parent = null,
    result = [],
    intersection = null,
    ignoreFn = null,
    includeDescendants = false
  ) {
    if (width > 0 || height > 0 || intersection) {
      const model = this.getDataModel();
      const right = x + width;
      const bottom = y + height;

      if (!parent) {
        parent = this.getCurrentRoot();

        if (!parent) {
          parent = model.getRoot();
        }
      }

      if (parent) {
        for (const cell of parent.getChildren()) {
          const state = this.getView().getState(cell);

          if (state && cell.isVisible() && (!ignoreFn || !ignoreFn(state))) {
            const deg = state.style.rotation ?? 0;

            let box: CellState | Rectangle = state; // TODO: CHECK ME!!!! ==========================================================
            if (deg !== 0) {
              box = <Rectangle>getBoundingBox(box, deg);
            }

            const hit =
              (intersection && cell.isVertex() && intersects(intersection, box)) ||
              (!intersection &&
                (cell.isEdge() || cell.isVertex()) &&
                box.x >= x &&
                box.y + box.height <= bottom &&
                box.y >= y &&
                box.x + box.width <= right);

            if (hit) {
              result.push(cell);
            }

            if (!hit || includeDescendants) {
              this.getCells(
                x,
                y,
                width,
                height,
                cell,
                result,
                intersection,
                ignoreFn,
                includeDescendants
              );
            }
          }
        }
      }
    }
    return result;
  },

  getCellsBeyond(x0, y0, parent = null, rightHalfpane = false, bottomHalfpane = false) {
    const result = [];

    if (rightHalfpane || bottomHalfpane) {
      if (!parent) {
        parent = this.getDefaultParent();
      }

      if (parent) {
        for (const child of parent.getChildren()) {
          const state = this.getView().getState(child);
          if (child.isVisible() && state) {
            if ((!rightHalfpane || state.x >= x0) && (!bottomHalfpane || state.y >= y0)) {
              result.push(child);
            }
          }
        }
      }
    }
    return result;
  },

  intersects(state, x, y) {
    const pts = state.absolutePoints;

    if (pts.length > 0) {
      const t2 = this.getEventTolerance() * this.getEventTolerance();
      let pt = pts[0];

      for (let i = 1; i < pts.length; i += 1) {
        const next = pts[i];

        if (pt && next) {
          const dist = ptSegDistSq(pt.x, pt.y, next.x, next.y, x, y);

          if (dist <= t2) {
            return true;
          }
        }

        pt = next;
      }
    } else {
      const alpha = toRadians(state.style.rotation ?? 0);

      if (alpha !== 0) {
        const cos = Math.cos(-alpha);
        const sin = Math.sin(-alpha);
        const cx = new Point(state.getCenterX(), state.getCenterY());
        const pt = getRotatedPoint(new Point(x, y), cos, sin, cx);
        x = pt.x;
        y = pt.y;
      }

      if (contains(state, x, y)) {
        return true;
      }
    }
    return false;
  },

  isValidAncestor(cell, parent, recurse = false) {
    return recurse ? parent.isAncestor(cell) : cell.getParent() === parent;
  },

  /*****************************************************************************
   * Group: Graph behaviour
   *****************************************************************************/

  isCellLocked(cell) {
    const geometry = cell.getGeometry();

    return this.isCellsLocked() || (!!geometry && cell.isVertex() && geometry.relative);
  },

  isCellsLocked() {
    return this.cellsLocked;
  },

  setCellsLocked(value) {
    this.cellsLocked = value;
  },

  getCloneableCells(cells) {
    return this.getDataModel().filterCells(cells, (cell: Cell) => {
      return this.isCellCloneable(cell);
    });
  },

  isCellCloneable(cell) {
    const style = this.getCurrentCellStyle(cell);
    const cloneable = style.cloneable == null ? true : style.cloneable;
    return this.isCellsCloneable() && cloneable;
  },

  isCellsCloneable() {
    return this.cellsCloneable;
  },

  setCellsCloneable(value) {
    this.cellsCloneable = value;
  },

  getExportableCells(cells) {
    return this.getDataModel().filterCells(cells, (cell: Cell) => {
      return this.canExportCell(cell);
    });
  },

  canExportCell(_cell = null) {
    return this.isExportEnabled();
  },

  getImportableCells(cells) {
    return this.getDataModel().filterCells(cells, (cell: Cell) => {
      return this.canImportCell(cell);
    });
  },

  canImportCell(cell = null) {
    return this.isImportEnabled();
  },

  isCellSelectable(_cell) {
    return this.isCellsSelectable();
  },

  isCellsSelectable() {
    return this.cellsSelectable;
  },

  setCellsSelectable(value) {
    this.cellsSelectable = value;
  },

  getDeletableCells(cells) {
    return this.getDataModel().filterCells(cells, (cell: Cell) => {
      return this.isCellDeletable(cell);
    });
  },

  isCellDeletable(cell) {
    const style = this.getCurrentCellStyle(cell);
    const deletable = style.deletable == null ? true : style.deletable;
    return this.isCellsDeletable() && deletable;
  },

  isCellsDeletable() {
    return this.cellsDeletable;
  },

  setCellsDeletable(value) {
    this.cellsDeletable = value;
  },

  isCellRotatable(cell) {
    const style = this.getCurrentCellStyle(cell);
    return style.rotatable == null ? true : style.rotatable;
  },

  getMovableCells(cells) {
    return this.getDataModel().filterCells(cells, (cell: Cell) => {
      return this.isCellMovable(cell);
    });
  },

  isCellMovable(cell) {
    const style = this.getCurrentCellStyle(cell);
    return this.isCellsMovable() && !this.isCellLocked(cell) && (style.movable ?? true);
  },

  isCellsMovable() {
    return this.cellsMovable;
  },

  setCellsMovable(value) {
    this.cellsMovable = value;
  },

  isCellResizable(cell) {
    const style = this.getCurrentCellStyle(cell);
    return (
      this.isCellsResizable() && !this.isCellLocked(cell) && (style.resizable ?? true)
    );
  },

  isCellsResizable() {
    return this.cellsResizable;
  },

  setCellsResizable(value) {
    this.cellsResizable = value;
  },

  isCellBendable(cell) {
    const style = this.getCurrentCellStyle(cell);
    return this.isCellsBendable() && !this.isCellLocked(cell) && style.bendable != false;
  },

  isCellsBendable() {
    return this.cellsBendable;
  },

  setCellsBendable(value) {
    this.cellsBendable = value;
  },

  isAutoSizeCell(cell) {
    const style = this.getCurrentCellStyle(cell);
    return this.isAutoSizeCells() || (style.autoSize ?? false);
  },

  isAutoSizeCells() {
    return this.autoSizeCells;
  },

  setAutoSizeCells(value) {
    this.autoSizeCells = value;
  },

  isExtendParent(cell) {
    return !cell.isEdge() && this.isExtendParents();
  },

  isExtendParents() {
    return this.extendParents;
  },

  setExtendParents(value) {
    this.extendParents = value;
  },

  isExtendParentsOnAdd(cell) {
    return this.extendParentsOnAdd;
  },

  setExtendParentsOnAdd(value) {
    this.extendParentsOnAdd = value;
  },

  isExtendParentsOnMove() {
    return this.extendParentsOnMove;
  },

  setExtendParentsOnMove(value) {
    this.extendParentsOnMove = value;
  },

  /*****************************************************************************
   * Group: Graph appearance
   *****************************************************************************/

  getCursorForCell(_cell) {
    return null;
  },

  /*****************************************************************************
   * Group: Graph display
   *****************************************************************************/

  getCellBounds(cell, includeEdges = false, includeDescendants = false) {
    let cells = [cell];

    // Includes all connected edges
    if (includeEdges) {
      cells = cells.concat(cell.getEdges());
    }

    let result = this.getView().getBounds(cells);

    // Recursively includes the bounds of the children
    if (includeDescendants) {
      for (const child of cell.getChildren()) {
        const tmp = this.getCellBounds(child, includeEdges, true);

        if (result && tmp) {
          result.add(tmp);
        } else {
          result = tmp;
        }
      }
    }
    return result;
  },

  getBoundingBoxFromGeometry(cells, includeEdges = false) {
    let result = null;
    let tmp: Rectangle | null = null;

    for (const cell of cells) {
      if (includeEdges || cell.isVertex()) {
        // Computes the bounding box for the points in the geometry
        const geo = cell.getGeometry();
        if (geo) {
          let bbox = null;

          if (cell.isEdge()) {
            const addPoint = (pt: Point | null) => {
              if (pt) {
                if (!tmp) {
                  tmp = new Rectangle(pt.x, pt.y, 0, 0);
                } else {
                  tmp.add(new Rectangle(pt.x, pt.y, 0, 0));
                }
              }
            };

            if (!cell.getTerminal(true)) {
              addPoint(geo.getTerminalPoint(true));
            }

            if (!cell.getTerminal(false)) {
              addPoint(geo.getTerminalPoint(false));
            }

            const pts = geo.points;

            if (pts && pts.length > 0) {
              tmp = new Rectangle(pts[0].x, pts[0].y, 0, 0);

              for (let j = 1; j < pts.length; j++) {
                addPoint(pts[j]);
              }
            }

            bbox = tmp;
          } else {
            const parent = cell.getParent();

            if (geo.relative && parent) {
              if (parent.isVertex() && parent !== this.getView().currentRoot) {
                tmp = this.getBoundingBoxFromGeometry([parent], false);

                if (tmp) {
                  bbox = new Rectangle(
                    geo.x * tmp.width,
                    geo.y * tmp.height,
                    geo.width,
                    geo.height
                  );

                  if (cells.indexOf(parent) >= 0) {
                    bbox.x += tmp.x;
                    bbox.y += tmp.y;
                  }
                }
              }
            } else {
              bbox = Rectangle.fromRectangle(geo);

              if (parent && parent.isVertex() && cells.indexOf(parent) >= 0) {
                tmp = this.getBoundingBoxFromGeometry([parent], false);

                if (tmp) {
                  bbox.x += tmp.x;
                  bbox.y += tmp.y;
                }
              }
            }

            if (bbox && geo.offset) {
              bbox.x += geo.offset.x;
              bbox.y += geo.offset.y;
            }

            const style = this.getCurrentCellStyle(cell);
            if (bbox) {
              const angle = style.rotation ?? 0;
              if (angle !== 0) {
                bbox = getBoundingBox(bbox, angle);
              }
            }
          }

          if (bbox) {
            if (!result) {
              result = Rectangle.fromRectangle(bbox);
            } else {
              result.add(bbox);
            }
          }
        }
      }
    }
    return result;
  },
};

mixInto(Graph)(CellsMixin);
