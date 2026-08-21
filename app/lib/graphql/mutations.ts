// Sessions
export const createSession = /* GraphQL */ `
  mutation CreateSession($input: CreateSession_prueba_whatsappInput!) {
    createSession_prueba_whatsapp(input: $input) {
      id
      sessionId
      token
      latitude
      longitude
      createdAt
      expiresAt
      phoneNumber
      active
    }
  }
`;

export const updateSession = /* GraphQL */ `
  mutation UpdateSession($input: UpdateSession_prueba_whatsappInput!) {
    updateSession_prueba_whatsapp(input: $input) {
      id
      sessionId
      token
      latitude
      longitude
      createdAt
      expiresAt
      phoneNumber
      active
    }
  }
`;

export const deleteSession = /* GraphQL */ `
  mutation DeleteSession($input: DeleteSession_prueba_whatsappInput!) {
    deleteSession_prueba_whatsapp(input: $input) {
      id
    }
  }
`;

// Games
export const createGame = /* GraphQL */ `
  mutation CreateGame($input: CreateGame_prueba_whatsappInput!) {
    createGame_prueba_whatsapp(input: $input) {
      id
      name
      description
      icon
    }
  }
`;

// Bets
export const createBet = /* GraphQL */ `
  mutation CreateBet($input: CreateBet_prueba_whatsappInput!) {
    createBet_prueba_whatsapp(input: $input) {
      id
      sessionId
      gameId
      drawId
      drawName
      number
      amount
      paidAt
      source
      createdAt
    }
  }
`;

// Conversations
export const createConversation = /* GraphQL */ `
  mutation CreateConversation($input: CreateConversation_prueba_whatsappInput!) {
    createConversation_prueba_whatsapp(input: $input) {
      id
      phoneNumber
      sessionId
      state
      selectedGame
      selectedDraw
      betNumber
      betAmount
      currentPage
      updatedAt
    }
  }
`;

export const updateConversation = /* GraphQL */ `
  mutation UpdateConversation($input: UpdateConversation_prueba_whatsappInput!) {
    updateConversation_prueba_whatsapp(input: $input) {
      id
      phoneNumber
      sessionId
      state
      selectedGame
      selectedDraw
      betNumber
      betAmount
      currentPage
      updatedAt
    }
  }
`;
