import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import PostJob from "./pages/recruiter/PostJob";
import MyJobs from "./pages/recruiter/MyJobs";
import ApplyJob from "./pages/jobs/ApplyJob";
import { Spinner } from "./components/ui";

// Chart pages pull in recharts; load them on demand so the public apply page stays light.
const RecruiterDashboard = lazy(() => import("./pages/recruiter/Dashboard"));
const JobApplications = lazy(() => import("./pages/recruiter/JobApplications"));
const CandidateDetail = lazy(() => import("./pages/recruiter/CandidateDetail"));
const PipelineBoard = lazy(() => import("./pages/recruiter/PipelineBoard"));

function AppRoutes() {
  const { user, loading } = useAuth();

  // Show loading spinner while auth state is being determined
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className={user ? "pt-[113px] md:pt-16" : "pt-16"}>
        <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={
            user ? <Navigate to="/recruiter/dashboard" replace /> : <Login />
          } />
          <Route path="/register" element={
            user ? <Navigate to="/recruiter/dashboard" replace /> : <Register />
          } />

          {/* Recruiter routes */}
          <Route path="/recruiter/dashboard" element={
            <ProtectedRoute role="recruiter"><RecruiterDashboard /></ProtectedRoute>
          } />
          <Route path="/recruiter/jobs" element={
            <ProtectedRoute role="recruiter"><MyJobs /></ProtectedRoute>
          } />
          <Route path="/recruiter/jobs/new" element={
            <ProtectedRoute role="recruiter"><PostJob /></ProtectedRoute>
          } />
          <Route path="/recruiter/jobs/:id/edit" element={
            <ProtectedRoute role="recruiter"><PostJob /></ProtectedRoute>
          } />
          <Route path="/recruiter/jobs/:jobId/applications" element={
            <ProtectedRoute role="recruiter"><JobApplications /></ProtectedRoute>
          } />
          <Route path="/recruiter/applications/:id" element={
            <ProtectedRoute role="recruiter"><CandidateDetail /></ProtectedRoute>
          } />
          <Route path="/recruiter/jobs/:jobId/pipeline" element={
            <ProtectedRoute role="recruiter"><PipelineBoard /></ProtectedRoute>
          } />

          {/* Public */}
          <Route path="/jobs/apply/:jobId" element={<ApplyJob />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
} 
