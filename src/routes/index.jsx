import { createBrowserRouter } from "react-router-dom";
import { RootLayout } from "@/layouts/RootLayout.jsx";
import { ErrorPage } from "@/layouts/ErrorPage.jsx";
import { TasksPage } from "@/pages/TasksPage.jsx";
import { DashboardPage } from "@/pages/DashboardPage.jsx";
import { AdminPage } from "@/pages/AdminPage.jsx";
import { ConnectPage } from "@/pages/ConnectPage.jsx";
import { ConnectCallbackPage } from "@/pages/ConnectCallbackPage.jsx";
import { SuperAdminLoginPage } from "@/pages/SuperAdminLoginPage.jsx";
import { Level10Page } from "@/pages/Level10Page.jsx";
import { Level10MeetingPage } from "@/pages/Level10MeetingPage.jsx";

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
      { path: "level10", element: <Level10Page /> },
      { path: "level10/:eventId", element: <Level10MeetingPage /> },
    ],
  },
]);
