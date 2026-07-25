import AuthGuard from "@/components/auth/AuthGuard"; import MobilePublicShell from "@/components/mobile/MobilePublicShell"; import MobileHome from "@/components/mobile/MobileHome";
export default function Page(){return <AuthGuard mode="user"><MobilePublicShell title="Home"><MobileHome/></MobilePublicShell></AuthGuard>}
