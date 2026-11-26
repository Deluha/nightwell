// Generated on 2026-11-26 by `supabase gen types --lang typescript --local --workdir fixture`
// (the CLI version locked in package.json) from the fixture's migrations; regenerate, never hand-edit.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "##[group]nightwell": {
                  Row: {
                    "../../etc/passwd": string | null,"back\\slash": string | null,"back`tick": string | null,"id": number,"it's": string | null,"line\nbreak": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "../../etc/passwd"?: string | null,"back\\slash"?: string | null,"back`tick"?: string | null,"id": number,"it's"?: string | null,"line\nbreak"?: string | null
                  }
                  Update: {
                    "../../etc/passwd"?: string | null,"back\\slash"?: string | null,"back`tick"?: string | null,"id"?: number,"it's"?: string | null,"line\nbreak"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"<script>alert(1)</script>": {
                  Row: {
                    "::error file=x::nightwell": string | null,"\u001b[31mred": string | null,"id": number,"say \"hi\"": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "::error file=x::nightwell"?: string | null,"\u001b[31mred"?: string | null,"id": number,"say \"hi\""?: string | null
                  }
                  Update: {
                    "::error file=x::nightwell"?: string | null,"\u001b[31mred"?: string | null,"id"?: number,"say \"hi\""?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"archived_bottles": {
                  Row: {
                    "id": number | null,"name": string | null,"vintage": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: number | null,"name"?: string | null,"vintage"?: number | null
                  }
                  Update: {
                    "id"?: number | null,"name"?: string | null,"vintage"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"bottle_embeddings": {
                  Row: {
                    "bottle_id": number,"flavour_embedding": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bottle_id": number,"flavour_embedding"?: string | null
                  }
                  Update: {
                    "bottle_id"?: number,"flavour_embedding"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "bottle_embeddings_bottle_id_fkey"
      columns: ["bottle_id"]
isOneToOne: true
      referencedRelation: "bottles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bottle_embeddings_bottle_id_fkey"
      columns: ["bottle_id"]
isOneToOne: true
      referencedRelation: "my_bottles"
      referencedColumns: ["id"]
    }
                  ]
                },"bottles": {
                  Row: {
                    "added_by": string,"cellar_id": string,"id": number,"name": string,"quantity": number,"vintage": number | null,"vintage_decade": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "added_by"?: string,"cellar_id": string,"id"?: never,"name": string,"quantity"?: number,"vintage"?: number | null,"vintage_decade"?: never
                  }
                  Update: {
                    "added_by"?: string,"cellar_id"?: string,"id"?: never,"name"?: string,"quantity"?: number,"vintage"?: number | null,"vintage_decade"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "bottles_cellar_id_fkey"
      columns: ["cellar_id"]
isOneToOne: false
      referencedRelation: "cellars"
      referencedColumns: ["id"]
    }
                  ]
                },"cellars": {
                  Row: {
                    "created_at": string | null,"created_by": string,"id": string,"is_public": boolean,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"created_by"?: string,"id"?: string,"is_public"?: boolean,"name": string
                  }
                  Update: {
                    "created_at"?: string | null,"created_by"?: string,"id"?: string,"is_public"?: boolean,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"grape_varieties": {
                  Row: {
                    "colour": string,"id": number,"legacy_token": string | null,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "colour": string,"id"?: never,"legacy_token"?: string | null,"name": string
                  }
                  Update: {
                    "colour"?: string,"id"?: never,"legacy_token"?: string | null,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"members": {
                  Row: {
                    "cellar_id": string,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cellar_id": string,"role": string,"user_id": string
                  }
                  Update: {
                    "cellar_id"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "members_cellar_id_fkey"
      columns: ["cellar_id"]
isOneToOne: false
      referencedRelation: "cellars"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "display_name": string | null,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "display_name"?: string | null,"id": string
                  }
                  Update: {
                    "display_name"?: string | null,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"shelves": {
                  Row: {
                    "cellar_id": string,"id": string,"label": string,"layout": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cellar_id": string,"id"?: string,"label": string,"layout"?: Json | null
                  }
                  Update: {
                    "cellar_id"?: string,"id"?: string,"label"?: string,"layout"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "shelves_cellar_id_fkey"
      columns: ["cellar_id"]
isOneToOne: false
      referencedRelation: "cellars"
      referencedColumns: ["id"]
    }
                  ]
                },"tasting_notes": {
                  Row: {
                    "author_id": string,"bottle_id": number,"id": number,"note": string | null,"score": number | null,"tasted_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"bottle_id": number,"id"?: never,"note"?: string | null,"score"?: number | null,"tasted_on": string
                  }
                  Update: {
                    "author_id"?: string,"bottle_id"?: number,"id"?: never,"note"?: string | null,"score"?: number | null,"tasted_on"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasting_notes_bottle_id_fkey"
      columns: ["bottle_id"]
isOneToOne: false
      referencedRelation: "bottles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasting_notes_bottle_id_fkey"
      columns: ["bottle_id"]
isOneToOne: false
      referencedRelation: "my_bottles"
      referencedColumns: ["id"]
    }
                  ]
                },"tasting_notes_2025": {
                  Row: {
                    "author_id": string,"bottle_id": number,"id": number,"note": string | null,"score": number | null,"tasted_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"bottle_id": number,"id"?: never,"note"?: string | null,"score"?: number | null,"tasted_on": string
                  }
                  Update: {
                    "author_id"?: string,"bottle_id"?: number,"id"?: never,"note"?: string | null,"score"?: number | null,"tasted_on"?: string
                  }
                  Relationships: [
                    
                  ]
                },"tasting_notes_2026": {
                  Row: {
                    "author_id": string,"bottle_id": number,"id": number,"note": string | null,"score": number | null,"tasted_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"bottle_id": number,"id"?: never,"note"?: string | null,"score"?: number | null,"tasted_on": string
                  }
                  Update: {
                    "author_id"?: string,"bottle_id"?: number,"id"?: never,"note"?: string | null,"score"?: number | null,"tasted_on"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "cellar_stats": {
                  Row: {
                    "cellar_id": string,"member_count": number | null,"refreshed_as_role": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "members_cellar_id_fkey"
      columns: ["cellar_id"]
isOneToOne: false
      referencedRelation: "cellars"
      referencedColumns: ["id"]
    }
                  ]
                },"hostile_view": {
                  Row: {
                    "label": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"my_bottles": {
                  Row: {
                    "cellar_id": string,"id": number,"name": string,"quantity": number,"vintage": number | null
                  }
                  ComputedFields: never
                  Insert: {
                           "cellar_id"?: string | null,"id"?: number | null,"name"?: string | null,"quantity"?: number | null,"vintage"?: number | null
                         }
                        Update: {
                           "cellar_id"?: string | null,"id"?: number | null,"name"?: string | null,"quantity"?: number | null,"vintage"?: number | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "bottles_cellar_id_fkey"
      columns: ["cellar_id"]
isOneToOne: false
      referencedRelation: "cellars"
      referencedColumns: ["id"]
    }
                  ]
                },"partner_feed": {
                  Row: {
                    "feed_key": string | null,"id": number,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                           "feed_key"?: never,"id"?: number | null,"name"?: string | null
                         }
                        Update: {
                           "feed_key"?: never,"id"?: number | null,"name"?: string | null
                         }
                        Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "::error file=x::fn":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"\u001b[31mfn":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"##[group]fn":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"<script>fn</script>":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"add_bottle":
{ Args: { "bottle_name": string,"bottle_vintage": number,"cellar": string }; Returns: number
                           },
"announce_pour":
{ Args: { "cellar": string }; Returns: undefined
                           },
"bottle_age":
{ Args: { "in_year": number,"vintage": number }; Returns: number
                           },
"cellar_summary":
{ Args: { "cellar": string }; Returns: {
              "bottle_count": number,"total_quantity": number
            }[]
                           },
"check_request":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"count_rows":
{ Args: { "target": string }; Returns: number
                           },
"custom_access_token_hook":
{ Args: { "event": Json }; Returns: Json
                           },
"fn'quote\"double`tick":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"helper_name_text":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"hostile_text":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"new_share_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"now":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"public_cellar_count":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"reader_label":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"request_restock":
{ Args: { "bottle": number }; Returns: number
                           },
"search_bottles":
{ Args: { "q": string }; Returns: {
              "added_by": string,
"cellar_id": string,
"id": number,
"name": string,
"quantity": number,
"vintage": number | null,
"vintage_decade": number | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "bottles"
        isOneToOne: false
        isSetofReturn: true
      } }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
