export const selectStyle = { padding: "9px 10px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 14, background: "#fff" };
export const inputStyle = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 14 };
export const iconBtnStyle = { background: "#F3F4F6", border: "none", borderRadius: 6, padding: 6, display: "flex", color: "#374151" };
export const overlayStyle = { position: "fixed", inset: 0, background: "rgba(15,36,56,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 };
export const modalStyle = { background: "#fff", borderRadius: 14, padding: 22, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" };

export function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}
