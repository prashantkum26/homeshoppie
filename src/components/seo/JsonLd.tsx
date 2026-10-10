interface JsonLdProps {
  data: Record<string, unknown>
  nonce?: string | undefined // <-- Add "| undefined" here
}

export function JsonLd({ data, nonce }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  )
}