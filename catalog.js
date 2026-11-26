/* ============ CATÁLOGO: edite aqui para cadastrar ou alterar produtos ============ */
const CATALOG = {
  price: 99,
  /* Dados técnicos que aparecem em "Especificações" de todos os produtos.
     Preencha o que quiser mostrar; o que ficar vazio ("") não aparece. */
  specs: {
    medidas:  "",   // ex.: "900 x 400 x 3 mm"
    material: "",   // ex.: "Tecido speed com base antiderrapante"
    base:     ""    // ex.: "Borracha antiderrapante"
  },
  items: [
    {
      id: "lobo", name: "Lobo de Gelo", badge: "Mais vendido", img: "/images/lobo.png",
      short: "O predador do gelo em plena investida, com armadura de cristal e aurora boreal ao fundo.",
      long: [
        "O Lobo de Gelo domina o campo: um predador de armadura de cristal, em plena investida sob uma aurora boreal.",
        "Arte exclusiva da coleção Avalanche, impressa no mousepad com borda costurada para um acabamento firme e durável."
      ],
      highlights: ["Arte exclusiva da coleção Avalanche", "Borda costurada", "Tema gelo, em tons de azul"]
    },
    {
      id: "dragao", name: "Dragão de Gelo", badge: "Lançamento", img: "/images/dragao.png",
      short: "Asas de cristal e sopro congelante sobre as montanhas geladas. Imponente do início ao fim.",
      long: [
        "O Dragão de Gelo sobrevoa as montanhas congeladas com asas de cristal e um sopro que cobre tudo de gelo.",
        "Arte exclusiva da coleção Avalanche, impressa no mousepad com borda costurada para um acabamento firme e durável."
      ],
      highlights: ["Arte exclusiva da coleção Avalanche", "Borda costurada", "Tema gelo, em tons de azul"]
    }
  ]
};
/* ================================================================================ */
