/**
 * Mapeamento de Índices para Estados
 * Os IDs no SVG estão atribuídos na ordem errada, então precisamos mapear
 * qual índice no array de paths corresponde a qual estado real
 */

// Mapeamento: qual ÍNDICE no array de paths corresponde a qual estado REAL
// Baseado na descrição: "no Acre tá dizendo Alagoas 1" = índice 1 é o estado real AC
export const MAPEAMENTO_INDICE_PARA_ESTADO = {
    // Região Norte
    0: 'ro',   // Rondônia (está mostrando "Acre 0")
    1: 'ac',   // Acre (está mostrando "Alagoas 1") ✅ CORRIGIDO
    2: 'am',   // Amazonas (está mostrando "Amapá 2")
    3: 'rr',   // Roraima (está mostrando "Amazonas 3")
    4: 'ap',   // Amapá (está mostrando "Bahia 4")
    21: 'pa',  // Pará (está mostrando "Rondônia 21")
    6: 'mt',   // Mato Grosso (está mostrando "Distrito Federal 6")
    5: 'to',   // Tocantins (está mostrando "Ceará 5")
    
    // Região Nordeste
    20: 'ma',  // Maranhão (está mostrando "Rio Grande do Sul 20")
    13: 'pi',  // Piauí (está mostrando "Pará 13")
    14: 'ce',  // Ceará (está mostrando "Paraíba 14")
    15: 'rn',  // Rio Grande do Norte (está mostrando "Paraná 15") ✅ CORRIGIDO
    19: 'pe',  // Pernambuco (está mostrando "Rio Grande do Norte 19")
    16: 'al',  // Alagoas (está mostrando "Pernambuco 16")
    17: 'se',  // Sergipe (está mostrando "Piauí 17")
    12: 'ba',  // Bahia (está mostrando "Minas Gerais 12")
    9: 'mg',   // Minas Gerais (está mostrando "Maranhão 9")
    26: 'pb',  // Paraíba (está mostrando "Tocantins 26") ✅ CORRIGIDO
    
    // Região Centro-Oeste
    8: 'ms',   // Mato Grosso do Sul (está mostrando "Goiás 8")
    10: 'pr',  // Paraná (está mostrando "Mato Grosso 10")
    // GO - Goiás: precisa descobrir qual índice mostra "Espírito Santo"
    // DF - Distrito Federal: precisa descobrir qual índice
    
    // Região Sudeste
    22: 'sp',  // São Paulo (está mostrando "Roraima 22")
    24: 'es',  // Espírito Santo (está mostrando "São Paulo 24")
    23: 'rj',  // Rio de Janeiro (está mostrando "Santa Catarina 23" mas aponta para RJ) ✅ CORRIGIDO
    // DF - Distrito Federal: precisa descobrir qual índice realmente é
    // GO - Goiás: você disse que está mostrando "Espírito Santo", então preciso descobrir qual índice
    
    // Região Sul
    25: 'sc',  // Santa Catarina (está mostrando "Sergipe 25")
    11: 'rs'   // Rio Grande do Sul (está mostrando "Mato Grosso do Sul 11")
    
    // Estados ainda faltantes:
    // GO - Goiás (está mostrando "Espírito Santo" - qual índice?)
    // DF - Distrito Federal (não mencionado - qual índice?)
};

/**
 * Busca o índice de um estado no array de paths
 */
export function getIndicePorEstado(estadoId) {
    const indice = Object.keys(MAPEAMENTO_INDICE_PARA_ESTADO).find(
        idx => MAPEAMENTO_INDICE_PARA_ESTADO[idx] === estadoId.toLowerCase()
    );
    return indice !== undefined ? parseInt(indice) : null;
}

/**
 * Busca o estado real pelo índice
 */
export function getEstadoPorIndice(indice) {
    return MAPEAMENTO_INDICE_PARA_ESTADO[indice] || null;
}

