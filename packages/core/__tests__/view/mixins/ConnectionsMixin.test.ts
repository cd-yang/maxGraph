/*
Copyright 2023-present The maxGraph project Contributors

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

import { describe, expect, test } from '@jest/globals';
import { createGraphWithoutPlugins } from '../../utils';
import { CellState, ConnectionConstraint, Shape, StencilShape } from '../../../src';

test('The "ConnectionHandler" plugin is not available', () => {
  const graph = createGraphWithoutPlugins();
  graph.setConnectable(true);
  graph.isConnectable();
  expect(graph.isConnectable()).toBe(false);
});

describe('getAllConnectionConstraints', () => {
  const graph = createGraphWithoutPlugins();
  test('null CellState', () => {
    expect(graph.getAllConnectionConstraints(null, true)).toBeNull();
  });

  test('CellState with null shape', () => {
    expect(graph.getAllConnectionConstraints(new CellState(), true)).toBeNull();
  });

  test('CellState with shape which is not a StencilShape', () => {
    const cellState = new CellState();
    cellState.shape = new Shape();
    expect(graph.getAllConnectionConstraints(cellState, true)).toBeNull();
  });

  test('CellState with shape which is a StencilShape', () => {
    class CustomStencilShape extends StencilShape {
      constructor(constraints: ConnectionConstraint[]) {
        super(null!);
        this.constraints = constraints;
      }
      parseDescription() {
        // do nothing
      }
      parseConstraints() {
        // do nothing, constraints passed in constructor
      }
    }

    const cellState = new CellState();
    const constraints = [new ConnectionConstraint(null), new ConnectionConstraint(null)];
    cellState.shape = new Shape(new CustomStencilShape(constraints));
    expect(graph.getAllConnectionConstraints(cellState, true)).toBe(constraints);
  });
});
