import { createBrowserRouter } from "react-router-dom";
import { RootLayout } from "@/layouts/RootLayout.jsx";
import { ErrorPage } from "@/layouts/ErrorPage.jsx";
import { TasksPage } from "@/pages/TasksPage.jsx";
import { DashboardPage } from "@/pages/DashboardPage.jsx";
import { AdminPage } from "@/pages/AdminPage.jsx";
import { ConnectPage } from "@/pages/ConnectPage.jsx";
import { ConnectCallbackPage } from "@/pages/ConnectCallbackPage.jsx";
import { SuperAdminLoginPage } from "@/pages/SuperAdminLoginPage.jsx";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <TasksPage /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "login", element: <SuperAdminLoginPage /> },
      { path: "admin", element: <AdminPage /> },
      { path: "connect", element: <ConnectPage /> },
      { path: "connect/callback", element: <ConnectCallbackPage /> },
    ],
  },
]);
