import AuthGuard from "@/components/auth/AuthGuard"; import MobilePublicShell from "@/components/mobile/MobilePublicShell"; import MyAccessAccountPage from "@/components/account/MyAccessAccountPage";
export default function Page(){return <AuthGuard mode="user"><MobilePublicShell title="My Account"><MyAccessAccountPage/></MobilePublicShell></AuthGuard>}
