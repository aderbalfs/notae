import Image from "next/image";

export function BrandHeader() {
  return (
    <header className="flex w-full items-center justify-center border-b border-zinc-100 bg-white px-6 py-3">
      <Image
        src="/brand/logo-itabaiana.png"
        alt="Prefeitura de Itabaiana — Cidade do Trabalho"
        width={1030}
        height={300}
        priority
        className="h-9 w-auto"
      />
    </header>
  );
}
