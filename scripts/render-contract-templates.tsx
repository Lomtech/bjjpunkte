/**
 * Render-Skript für die 3 Default-Vertrags-Templates.
 *
 * Output: 3 PDFs unter compliance/contract-templates/
 *  - membership.pdf
 *  - wellpass.pdf
 *  - trial.pdf
 *
 * Demo-Studio-Daten (nur für Validierung):
 *  - Combat-Sports-Center  (= {{gym_name}})
 *  - Brucker Str. 31, 82275 Emmering  (= {{gym_address}})
 *  - Emmering  (= {{gym_city}})
 *  - www.csc-ffb.de  (= {{gym_url}})
 *
 * Aufruf:
 *   npx tsx scripts/render-contract-templates.tsx
 */
import {
  resolveTemplate,
  type ContractKind,
} from '../src/lib/legal/default-contract'
import { renderToFile, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import React from 'react'

const OUT_DIR = join(__dirname, '..', 'compliance', 'contract-templates')

// Demo-Studio-Daten für Platzhalter-Substitution
const DEMO_GYM = {
  name:    'Combat-Sports-Center',
  address: 'Brucker Str. 31, 82275 Emmering',
  city:    'Emmering',
  url:     'www.csc-ffb.de',
}

const styles = StyleSheet.create({
  page:  { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#0f172a', lineHeight: 1.5 },
  body:  { fontSize: 9.5, color: '#1f2937' },
  para:  { marginBottom: 8 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 7, color: '#94a3b8', textAlign: 'center', borderTop: '0.5pt solid #e5e7eb', paddingTop: 6 },
})

function paragraphs(text: string): string[] {
  return text.split(/\n\n+/).map(p => p.trim()).filter(Boolean)
}

function ContractDoc({ title, body }: { title: string; body: string }) {
  return (
    <Document title={title}>
      <Page size="A4" style={styles.page}>
        <View>
          {paragraphs(body).map((p, i) => (
            <Text key={i} style={[styles.body, styles.para]}>{p}</Text>
          ))}
        </View>
        <Text style={styles.footer} fixed>
          {title} · Demo-Render aus default-contract.ts · {new Date().toLocaleString('de-DE')}
        </Text>
      </Page>
    </Document>
  )
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  const KINDS: { kind: ContractKind; filename: string; label: string }[] = [
    { kind: 'membership', filename: 'membership.pdf', label: 'Mitgliedschaftsvertrag' },
    { kind: 'wellpass',   filename: 'wellpass.pdf',   label: 'Wellpass-Vereinbarung' },
    { kind: 'trial',      filename: 'trial.pdf',      label: 'Probetraining-Regelungen' },
  ]

  for (const { kind, filename, label } of KINDS) {
    const text = resolveTemplate(kind, null /* kein Custom-Override */, DEMO_GYM)
    const outPath = join(OUT_DIR, filename)
    await renderToFile(<ContractDoc title={label} body={text} />, outPath)
    console.log(`✓ ${label.padEnd(30)} → ${outPath}`)
  }

  console.log('\n3 PDFs gerendert. Validierung:')
  console.log('  open ' + OUT_DIR)
}

main().catch(err => {
  console.error('Render failed:', err)
  process.exit(1)
})
