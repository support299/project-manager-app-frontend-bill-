import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  taskView: "list",
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setTaskView(state, action) {
      state.taskView = action.payload;
    },
  },
});

export const { setTaskView } = uiSlice.actions;
export default uiSlice.reducer;
