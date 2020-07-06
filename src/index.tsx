import React from "react";
import { Provider } from "react-redux";
import { render } from "react-dom";
import {
  store,
  useSelector,
  selectTreeTotal,
  selectXScale,
  selectYScale,
  useDispatch,
  selectDimensions,
  selectTransform,
  selectTrees,
  TreeDaily,
  displayModes,
  selectDisplayMode,
  selectAxisHeight,
} from "./store";
import { format, startOfDay, setDate, isSameMonth } from "date-fns";
import { zoom, zoomIdentity } from "d3-zoom";
import { event, select } from "d3-selection";
import { area, line, curveBasis } from "d3-shape";
import useMeasure from "react-use-measure";
import { config, animated, useSpring } from "react-spring";
// @ts-expect-error parcel importing svg
import treeIconURL from "./treeIcon.svg";
import { bisector } from "d3-array";

function Shell() {
  return (
    <Provider store={store}>
      <App />
    </Provider>
  );
}

function App() {
  return (
    <>
      <div className="controls">
        <Total />
        <div className="flexSpace" />
        <DisplayMode />
      </div>
      <Resizer />
      <Zoom>
        <TreeLine />
      </Zoom>
      <Axis />
      <MonthsAxis />
    </>
  );
}

/**
 * displays the total tree count
 */
function Total() {
  const total = useSelector(selectTreeTotal);
  const { opacity, totalTween } = useSpring({
    from: {
      opacity: 0,
      totalTween: 0,
    },
    totalTween: total,
    opacity: 1,
    config: {
      ...config.slow,
      clamp: true,
    },
  });
  return (
    <animated.div
      style={{
        opacity,
        display: "flex",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <img src={treeIconURL} height={50} alt="trees icon" />
      <span className="subtle">Trees Planted</span>
      <animated.h1>
        {totalTween.interpolate((x) => parseInt(x.toString()))}
      </animated.h1>
    </animated.div>
  );
}

/**
 * allows user to select the line graph y data
 */
function DisplayMode() {
  const dispatch = useDispatch();
  const activeDisplayMode = useSelector(selectDisplayMode);
  return (
    <div className="displayModeContainer">
      {displayModes.map((mode) => (
        <button
          key={mode}
          onClick={() =>
            void dispatch({
              type: "display mode option clicked",
              payload: { option: mode },
            })
          }
          style={{
            background:
              activeDisplayMode === mode ? "var(--buttonAttention)" : undefined,
          }}
        >
          {mode}
        </button>
      ))}
    </div>
  );
}

/**
 * tracks window height/width and updates store on resize
 */
function Resizer() {
  const dispatch = useDispatch();
  const [bind, { width, height }] = useMeasure();
  React.useEffect(
    () => void dispatch({ type: "resized", payload: { height, width } }),
    [dispatch, width, height]
  );
  return <div ref={bind} className="resizer"></div>;
}

/**
 * renders the x scale ticks day of month
 */
function Axis() {
  const xScale = useSelector(selectXScale);
  const height = useSelector(selectAxisHeight);
  const { width } = useSelector(selectDimensions);
  const canvas = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    if (!canvas.current || !xScale) return;
    const ctx = canvas.current!.getContext("2d")!;
    canvas.current!.width = width;
    canvas.current!.height = 20;
    ctx.clearRect(0, 0, width, 20);
    ctx.strokeStyle = "black";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.font = "15px 'Open Sans'";
    for (const tick of xScale.ticks(10)) {
      ctx.fillText(
        format(new Date(tick), "do"),
        Math.floor(xScale(tick)),
        height / 2
      );
    }
  }, [xScale, width]);
  return <canvas ref={canvas}></canvas>;
}

/**
 * renders the x scale ticks months / year
 */
function MonthsAxis() {
  const xScale = useSelector(selectXScale);
  const height = useSelector(selectAxisHeight);
  const { width } = useSelector(selectDimensions);
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const trees = useSelector(selectTrees);
  const months = React.useMemo(() => {
    const months: Date[] = [];
    for (const group of trees) {
      const tail = months[months.length - 1];
      const groupDate = new Date(group.date);
      if (!tail) months.push(startOfDay(setDate(groupDate, 1)));
      else if (!isSameMonth(tail, groupDate)) {
        months.push(startOfDay(setDate(groupDate, 1)));
      }
    }
    return months;
  }, [trees]);
  React.useEffect(() => {
    if (!canvas.current || !xScale) return;
    const ctx = canvas.current!.getContext("2d")!;
    canvas.current!.width = width;
    canvas.current!.height = 20;
    ctx.clearRect(0, 0, width, 20);
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.globalAlpha = 0.5;
    ctx.font = "15px 'Open Sans'";
    for (const month of months) {
      ctx.fillText(
        format(month, "LLL yy"),
        Math.floor(xScale(month)),
        height / 2
      );
    }
  }, [xScale, months, width]);
  return <canvas ref={canvas}></canvas>;
}

function TreeLine() {
  const xScale = useSelector(selectXScale);
  const yScale = useSelector(selectYScale);
  const displayMode = useSelector(selectDisplayMode);
  const trees = useSelector(selectTrees);

  const { width, height } = useSelector(selectDimensions);
  const canvas = React.useRef<HTMLCanvasElement>(null);

  const [xPos, setXPos] = React.useState<number | null>(null);

  const hoveredTree = React.useMemo(() => {
    try {
      if (!xScale || !trees.length || !xPos) return undefined;
      const mouseDate = xScale.invert(xPos);
      const bisectDate = bisector<TreeDaily, number>(function (d) {
        return Date.parse(d.date);
      }).left;
      const index = bisectDate(trees, mouseDate); // returns the index to the current data item

      const d0 = trees[index - 1];
      const d1 = trees[index];
      // work out which date value is closest to the mouse
      const d =
        mouseDate - Date.parse(d0.date) > Date.parse(d1.date) - mouseDate
          ? d1
          : d0;
      return d;
    } catch (error) {
      console.log(error);
      return undefined;
    }
  }, [xPos, trees, xScale, displayMode]);

  React.useEffect(() => {
    if (!canvas.current || !xScale || !yScale) return;

    const ctx = canvas.current!.getContext("2d")!;
    canvas.current!.width = xScale.range()[1];
    canvas.current!.height = yScale.range()[1];

    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = "#20bf85";
    ctx.fillStyle = "#0d414d";
    ctx.lineWidth = 5;

    const yAccessor = displayMode === "Cumulative" ? "cumulative" : "total";
    const lineFn = line<TreeDaily>()
      .x((d) => xScale(Date.parse(d.date)))
      .y((d) => height - yScale(d[yAccessor]))
      .curve(curveBasis)
      .context(ctx);
    const areaFn = area<TreeDaily>()
      .x((d) => xScale(Date.parse(d.date)))
      .y1((d) => height - yScale(d[yAccessor]))
      .y0(yScale(0))
      .curve(curveBasis)
      .context(ctx);
    ctx.beginPath();
    lineFn(trees);
    ctx.stroke();
    ctx.beginPath();
    areaFn(trees);
    ctx.fill();

    if (hoveredTree) {
      ctx.beginPath();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = "15px 'Open Sans'";
      ctx.arc(
        xScale(Date.parse(hoveredTree.date)),
        height - yScale(hoveredTree[yAccessor]),
        2,
        0,
        Math.PI * 2
      );
      ctx.fillText(
        hoveredTree[yAccessor].toString(),
        xScale(Date.parse(hoveredTree.date)),
        height - yScale(hoveredTree[yAccessor]) - 5
      );
      ctx.fill();
    }
  }, [xScale, trees, width, height, displayMode, hoveredTree]);
  return (
    <canvas
      style={{ background: "rgb(11, 160, 109)" }}
      ref={canvas}
      onMouseMove={(e) => void setXPos(e.nativeEvent.offsetX)}
      onMouseLeave={() => void setXPos(null)}
    />
  );
}

function Zoom({ children }: any) {
  const dispatch = useDispatch();
  const element = React.useRef<HTMLDivElement>(null);
  const transform = useSelector(selectTransform);
  const { width, height } = useSelector(selectDimensions);
  const _zoom = React.useMemo(
    () =>
      zoom()
        .translateExtent([
          [0, 0],
          [width, height],
        ])
        .scaleExtent([1, Infinity]),
    [width, height]
  );
  React.useEffect(() => {
    if (!element.current) return;
    _zoom.transform(
      // @ts-expect-error unsure but runtime ok - track
      select(element.current!),
      zoomIdentity.translate(transform.x, transform.y).scale(transform.k)
    );
  }, [_zoom, transform]);
  React.useEffect(() => {
    if (!element.current) return;
    // @ts-expect-error unsure but runtime ok - track
    _zoom(select(element.current!));
    _zoom.on("zoom", () => {
      dispatch({
        type: "zoomed",
        payload: {
          transform: event.transform,
        },
      });
    });
  }, [_zoom, dispatch]);
  return (
    <div id="zoom" ref={element}>
      {children}
    </div>
  );
}

render(<Shell />, document.getElementById("root"));

/**
// Not fully implemented.
// Display a slider to display key milestone e.g. 10k trees.
function MileStones() {
  const width = 500;
  const amount = 100;
  const [active, setActive] = React.useState(0);
  const [props, set] = useSprings(amount, (i) => ({
    x: i * width,
    display: "block",
  }));
  React.useEffect(() => {
    set((i) => {
      const x = (i - active) * width;
      return { x };
    });
  }, [set, active]);
  return (
    <div
      style={{
        height: 200,
        flex: "0 0 auto",
        width: "100%",
        position: "relative",
        display: "flex",
        alignItems: "center",
        backgroundImage: `url(${buntingIconURL})`,
        backgroundPosition: "top",
        backgroundRepeat: "repeat-x",
        backgroundSize: "auto 20px",
      }}
    >
      <div
        style={{ zIndex: 10, position: "absolute", left: 0 }}
        onClick={() =>
          setActive((active) => (active - 1 < 0 ? amount - 1 : active - 1))
        }
      >
        L
      </div>
      <div
        style={{ zIndex: 10, position: "absolute", right: 0 }}
        onClick={() => setActive((active) => (active + 1) % amount)}
      >
        R
      </div>
      {props.map(({ x, display }, i) => (
        <animated.div
          key={i}
          style={{
            display,
            transform: x.interpolate((x) => `translate3d(${x}px,0,0)`),
            height: "100%",
            position: "absolute",
            top: 25,
            left: 0,
            zIndex: 5,
            padding: 5,
            width,
          }}
        >
          <div
            style={{
              background: "white",
              padding: "30px 20px",
            }}
          >
            Achieved {i * 1000} Trees
          </div>
        </animated.div>
      ))}
    </div>
  );
}
 */
