import { call, put } from "typed-redux-saga";
import { Action } from "./store";

export function* rootSaga() {
  const data = yield* call(fetchTreesFromWorker);
  yield* put({
    type: "[saga] trees fetched",
    payload: data,
  } as Action);
}

function fetchTreesFromWorker() {
  return new Promise((res) => {
    const worker = new Worker("./worker.ts");
    worker.onmessage = (message) => {
      res(message.data);
    };
  });
}
