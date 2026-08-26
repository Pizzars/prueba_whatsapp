// Sessions
export const createSession = /* GraphQL */ `
  mutation CreateSession($input: CreateSession_prueba_whatsappInput!) {
    createSession(input: $input) {
      id
      sessionId
      token
      documento
      nombre
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
    updateSession(input: $input) {
      id
      sessionId
      token
      documento
      nombre
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
  mutation DeleteSession($input: DeleteInput!) {
    deleteSession(input: $input) {
      id
    }
  }
`;

// Games
export const createGame = /* GraphQL */ `
  mutation CreateGame($input: CreateGame_prueba_whatsappInput!) {
    createGame(input: $input) {
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
    createBet(input: $input) {
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
    createConversation(input: $input) {
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
    updateConversation(input: $input) {
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

// Config
export const createConfig = /* GraphQL */ `
  mutation CreateConfig($input: CreateConfig_prueba_whatsappInput!) {
    createConfig(input: $input) {
      id
      whatsappToken
      whatsappPhoneNumberId
      whatsappVerifyToken
      whatsappApiVersion
      testPhoneNumber
      geminiModel
      updatedAt
    }
  }
`;

export const updateConfig = /* GraphQL */ `
  mutation UpdateConfig($input: UpdateConfig_prueba_whatsappInput!) {
    updateConfig(input: $input) {
      id
      whatsappToken
      whatsappPhoneNumberId
      whatsappVerifyToken
      whatsappApiVersion
      testPhoneNumber
      geminiModel
      updatedAt
    }
  }
`;
