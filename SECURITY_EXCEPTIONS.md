# Security Exceptions

## xlsx Package Vulnerability

**Status**: Accepted Risk  
**Severity**: High (Prototype Pollution & ReDoS)  
**Package**: xlsx@^0.18.5  
**Advisories**: GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9

### Why Accepted:
- Only used client-side for exporting user's own data
- Not parsing untrusted external Excel files
- User controls all input data
- No server-side usage
- Export functionality is non-critical feature

### Mitigation:
- Monitor for xlsx updates with fixes
- Consider migration to safer alternative in future
- Usage limited to exportUtils.ts only

### Alternative Considered:
- exceljs (larger bundle size)
- Remove Excel export (impacts UX)

**Review Date**: March 2026  
**Next Review**: June 2026
