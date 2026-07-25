import AuthGuard from "@/components/auth/AuthGuard"; import MobilePublicShell from "@/components/mobile/MobilePublicShell"; import MobileGateCode from "@/components/mobile/MobileGateCode";
export default function Page(){return <AuthGuard mode="user"><MobilePublicShell title="Gate Code"><MobileGateCode/></MobilePublicShell></AuthGuard>}
