import { Provider } from "react-redux";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { SessionInitializer } from "@/app/SessionInitializer.jsx";
import { router } from "@/routes/index.jsx";
import { store } from "@/store/index.js";

export function AppProviders() {
  return (
    <Provider store={store}>
      <SessionInitializer>
        <RouterProvider router={router} />
        <Toaster richColors position="top-right" />
      </SessionInitializer>
    </Provider>
  );
}