import produce from "immer";
import { createStore, applyMiddleware, Dispatch } from "redux";
import createMiddleware from "redux-saga";
import { rootSaga } from "./rootSaga";
import { createSelector } from "reselect";
import {
  TypedUseSelectorHook,
  useSelector as useSelectorOriginal,
  useDispatch as useDispatchOriginal,
} from "react-redux";
import { composeWithDevTools } from "redux-devtools-extension";
import { max } from "d3-array";
import { scaleLinear } from "d3-scale";
import { ZoomTransform, zoomIdentity } from "d3-zoom";

export type Tree = {
  createdAt: string;
  value: number;
};

export type TreeDaily = {
  date: string;
  total: number;
  cumulative: number;
};

export const displayModes = ["Cumulative", "Daily"] as const;
export type DisplayMode = typeof displayModes[number];

export type State = {
  trees: TreeDaily[];
  transform: { x: number; y: number; k: number };
  dimensions: {
    width: number;
    height: number;
  };
  axisHeight: 30;
  displayMode: DisplayMode;
};

export type Action =
  | {
      type: "[saga] trees fetched";
      payload: {
        trees: TreeDaily[];
      };
    }
  | {
      type: "zoomed";
      payload: {
        transform: ZoomTransform;
      };
    }
  | {
      type: "resized";
      payload: {
        width: number;
        height: number;
      };
    }
  | {
      type: "display mode option clicked";
      payload: {
        option: DisplayMode;
      };
    };

function initialState(): State {
  return {
    transform: {
      x: 0,
      y: 0,
      k: 1,
    },
    dimensions: {
      width: 10000,
      height: window.innerHeight / 3,
    },
    axisHeight: 30,
    trees: [],
    displayMode: "Cumulative",
  };
}

function reducer(state: State = initialState(), action: Action): State {
  return produce(state, (draft) => {
    switch (action.type) {
      case "[saga] trees fetched": {
        draft.trees = action.payload.trees;
        break;
      }
      case "zoomed": {
        draft.transform.k = action.payload.transform.k;
        draft.transform.x = action.payload.transform.x;
        break;
      }
      case "resized": {
        const scale = action.payload.width / draft.dimensions.width;
        if (scale !== Infinity && !isNaN(scale)) {
          draft.transform.x = draft.transform.x * scale;
        }
        draft.dimensions.width = action.payload.width;
        draft.dimensions.height = action.payload.height;
        break;
      }
      case "display mode option clicked": {
        draft.displayMode = action.payload.option;
        break;
      }
    }
  });
}

const sagaMiddleware = createMiddleware();

export const store = createStore(
  reducer,
  composeWithDevTools(applyMiddleware(sagaMiddleware))
);

sagaMiddleware.run(rootSaga);

function identity<T>(i: T): T {
  return i;
}

export const selectDimensions = createSelector(
  [(s: State) => s.dimensions],
  identity
);
export const selectDisplayMode = createSelector(
  [(s: State) => s.displayMode],
  identity
);
export const selectTrees = createSelector([(s: State) => s.trees], identity);
export const selectTransform = createSelector(
  [(s: State) => s.transform],
  identity
);
export const selectTreeTotal = createSelector(
  [selectTrees],
  (trees) => trees[trees.length - 1]?.cumulative ?? 0
);
export const selectXScale = createSelector(
  [selectTrees, selectDimensions, selectTransform],
  (trees, { width }, transform) => {
    if (trees.length) {
      return zoomIdentity
        .translate(transform.x, transform.y)
        .scale(transform.k)
        .rescaleX(
          scaleLinear()
            .range([0, width])
            .domain([
              Date.parse(trees[0].date),
              Date.parse(trees[trees.length - 1].date),
            ])
        );
    } else return undefined;
  }
);

export const selectAxisHeight = createSelector(
  [(s: State) => s.axisHeight],
  identity
);

export const selectYScale = createSelector(
  [selectTrees, selectDisplayMode, selectDimensions, selectAxisHeight],
  (dataset, displayMode, { height }, axisHeight) => {
    const accessor = displayMode === "Cumulative" ? "cumulative" : "total";
    return dataset.length
      ? scaleLinear()
          .range([0, height - axisHeight * 2])
          .domain([0, max(dataset, (tree) => tree[accessor]) as number])
      : undefined;
  }
);

export const useSelector: TypedUseSelectorHook<State> = useSelectorOriginal;
export const useDispatch: () => Dispatch<Action> = useDispatchOriginal;
